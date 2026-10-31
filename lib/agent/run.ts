import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import { createEvent } from "@/lib/agent/ingest";
import {
  pushFollowUpEventId,
  runDomainFollowUps,
} from "@/lib/agent/domain-followup";
import { extractTextDrafts } from "@/lib/agent/extract-text";
import { detectImageMime } from "@/lib/agent/image-magic";
import { extractReceiptFromImage } from "@/lib/agent/receipt-vision";
import { preferSmsParseText } from "@/lib/agent/sms-text";
import { notifyUsers } from "@/lib/agent/notify";
import {
  decide,
  policyEnvFromProcess,
  type DraftKind,
  type PricedDraft,
} from "@/lib/agent/policy";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import {
  dedupeHash,
  findDuplicateCandidates,
  isReceiptStrongCandidate,
  type DuplicateCandidate,
} from "@/lib/ledger/dedupe";
import { receiptDraftToExpenseDraft } from "@/lib/ledger/receipt-client";
import { computeKrw } from "@/lib/ledger/money";
import { getDailyFxQuote } from "@/lib/ledger/fx-server";
import { onExpenseChanged } from "@/lib/agent/handlers/settlement";
import { pickTripForReceivedAt } from "@/lib/onboarding/agent-context";
import { parseReceivedAtMs } from "@/lib/onboarding/trip-window";

type TripMemberRow = {
  id: string;
  user_id: string | null;
  display_name?: string | null;
  auto_include?: boolean | null;
};

type TripRow = {
  id: string;
  user_id: string;
  start_date?: string | null;
  end_date?: string | null;
  currency?: string | null;
};

type EventRow = {
  id: string;
  user_id: string;
  trip_id: string | null;
  kind: string;
  source: string;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
};

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function recordStep(
  eventId: string,
  seq: number,
  tool: string,
  input: unknown,
  output: unknown,
  ms: number,
  ok: boolean
): Promise<void> {
  const admin = getAgentAdmin();
  if (!admin) return;
  await admin.from("agent_steps").insert({
    event_id: eventId,
    seq,
    tool,
    input,
    output,
    ms,
    ok,
  });
}

async function loadCtx(tripId: string, userId: string) {
  const admin = getAgentAdmin();
  if (!admin) return null;

  const { data: trip } = await admin
    .from("trips")
    .select("id, user_id, start_date, end_date, currency")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return null;

  const { data: members } = await admin
    .from("trip_members")
    .select("id, user_id, display_name, auto_include")
    .eq("trip_id", tripId);

  const list = (members ?? []) as TripMemberRow[];
  // Event actor must be a member — do not silently fall back to trip owner.
  const ownerMember = list.find((m) => m.user_id === userId) ?? null;

  return {
    trip: trip as TripRow,
    members: list,
    ownerMember,
  };
}

async function countAutoToday(userId: string, tripId: string): Promise<number> {
  const admin = getAgentAdmin();
  if (!admin) return 0;
  const start = `${todayKst()}T00:00:00+09:00`;
  const { count } = await admin
    .from("trip_expenses")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("created_by", userId)
    .eq("status", "auto")
    .gte("created_at", start);
  return count ?? 0;
}

async function priceDraft(
  draft: ExpenseDraftInput,
  ownerMemberId: string | null,
  members: TripMemberRow[]
): Promise<PricedDraft | null> {
  if (draft.amount == null || !draft.currency) return null;

  const currency = draft.currency.toUpperCase();
  let fxRate = 1;
  let fxResolved = true;
  let fxIsFallback = false;
  let fxDate: string | null = null;

  if (currency !== "KRW") {
    try {
      const fx = await getDailyFxQuote({
        currency,
        date: draft.spentOn ?? todayKst(),
      });
      if (!fx || !(fx.rate > 0)) {
        fxResolved = false;
        fxRate = 0;
      } else {
        fxRate = fx.rate;
        fxIsFallback = Boolean(fx.isFallback);
        fxDate = fx.rateDate ?? null;
      }
    } catch {
      fxResolved = false;
      fxRate = 0;
    }
  }

  const breakdown = computeKrw({
    amount: draft.amount,
    fxRate: fxRate > 0 ? fxRate : 0,
  });

  const kind: DraftKind =
    draft.kind === "cancel"
      ? "cancel"
      : draft.kind === "approval"
        ? "approval"
        : draft.confidence != null && draft.confidence < 0.3
          ? "other"
          : "unknown";

  return {
    origin: draft.origin ?? "rule",
    kind,
    confidence: draft.confidence ?? 0,
    currency,
    amount: draft.amount,
    krwAmount: breakdown.krwAmount,
    fxResolved: currency === "KRW" ? true : fxResolved,
    fxIsFallback,
    payerMemberId: draft.payerMemberId ?? ownerMemberId,
    unresolvedNames: [],
    warnings: draft.warnings ?? [],
    spentOn: draft.spentOn,
    // stash for commit
    ...( {
      __fxRate: fxRate,
      __fxDate: fxDate,
      __krwBase: breakdown.krwBase,
      __feeKrw: breakdown.feeKrw,
      __participants: (draft.participantMemberIds?.length
        ? draft.participantMemberIds
        : members
            .filter((m) => m.auto_include !== false)
            .map((m) => m.id)
      ) as string[],
      __merchant: draft.merchant,
      __category: draft.category,
    } as object),
  };
}

type PricedWithMeta = PricedDraft & {
  __fxRate?: number;
  __fxDate?: string | null;
  __krwBase?: number;
  __feeKrw?: number;
  __participants?: string[];
  __merchant?: string | null;
  __category?: string;
};

async function commitExpense(args: {
  actorId: string;
  tripId: string;
  eventId: string;
  index: number;
  priced: PricedWithMeta;
  draft: ExpenseDraftInput;
  reasons: string[];
  status: "auto" | "confirmed";
  /** agent-uploads 경로 (영수증 출처일 때만) */
  receiptPath?: string | null;
}): Promise<string | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;

  const isReceipt = args.draft.origin === "receipt";
  const payer = args.priced.payerMemberId;
  if (!payer) return null;

  const participants =
    args.priced.__participants && args.priced.__participants.length > 0
      ? args.priced.__participants
      : [payer];

  const shareKrw = Math.trunc(args.priced.krwAmount / participants.length);
  let allocated = 0;
  const shares = participants.map((memberId, i) => {
    const isLast = i === participants.length - 1;
    const krw = isLast
      ? args.priced.krwAmount - allocated
      : shareKrw;
    allocated += isLast ? 0 : shareKrw;
    return {
      member_id: memberId,
      share_krw: krw,
      input_value: null,
    };
  });

  const merchant = args.priced.__merchant ?? args.draft.merchant ?? "";
  const hash =
    args.draft.amount != null && args.draft.currency && args.draft.spentOn
      ? dedupeHash({
          currency: args.draft.currency,
          amount: args.draft.amount,
          merchant: merchant || "unknown",
          spentOn: args.draft.spentOn,
        })
      : null;

  const expense = {
    trip_id: args.tripId,
    created_by: args.actorId,
    paid_by: payer,
    label: merchant,
    merchant,
    category: args.priced.__category ?? "기타",
    amount: args.priced.amount,
    currency: args.priced.currency,
    // 카드 문자는 카드, 영수증은 읽은 값만(못 읽으면 attach RPC 가 null 로 비운다)
    payment_method: isReceipt ? (args.draft.paymentMethod ?? undefined) : "card",
    merchant_ko: isReceipt ? (args.draft.merchantKo ?? null) : undefined,
    items: isReceipt ? (args.draft.items ?? []) : undefined,
    fx_rate: args.priced.__fxRate ?? 1,
    fx_rate_to_krw: args.priced.__fxRate ?? 1,
    fx_rate_date: args.priced.__fxDate,
    fx_source: "auto_daily",
    fx_is_fallback: args.priced.fxIsFallback,
    fee_rate: 0,
    fee_flat_krw: 0,
    krw_base: args.priced.__krwBase ?? args.priced.krwAmount,
    fee_krw: args.priced.__feeKrw ?? 0,
    krw_amount: args.priced.krwAmount,
    source: isReceipt ? "receipt" : "sms",
    spent_on: args.draft.spentOn,
    paid_at: args.draft.paidAt,
    split_type: "equal",
    dedupe_hash: hash,
    raw_input: args.draft.rawInput ?? null,
  };

  const { data, error } = await admin.rpc("agent_save_expense", {
    p_actor: args.actorId,
    p_trip_id: args.tripId,
    p_expense: expense,
    p_shares: shares,
    p_status: args.status,
    p_event_id: args.eventId,
    p_index: args.index,
    p_reasons: { reasons: args.reasons },
  });

  if (error) {
    console.error("[commitExpense]", error.message);
    return null;
  }
  const expenseId = data as string;

  if (isReceipt && args.receiptPath) {
    // receipt_path 는 save RPC 가 받지 않으므로 attach RPC 로 붙인다 (실패해도 지출은 유지).
    const attached = await attachReceipt({
      actorId: args.actorId,
      expenseId,
      receiptPath: args.receiptPath,
      eventId: args.eventId,
      clearPaymentMethod: !args.draft.paymentMethod,
    });
    if (!attached.ok) {
      console.error("[commitExpense] attach receipt failed", attached.error);
    }
  }
  return expenseId;
}

type AttachResult =
  | { ok: true; attached: boolean; reason?: string }
  | { ok: false; error: string };

/**
 * 기존/신규 지출에 영수증 경로를 붙인다 (agent_attach_receipt, 기존 값 덮어쓰기 없음).
 * 새 지출을 만들지 않으므로 이중 기록이 생기지 않는다.
 */
async function attachReceipt(args: {
  actorId: string;
  expenseId: string;
  receiptPath: string;
  eventId: string;
  draft?: ExpenseDraftInput;
  clearPaymentMethod?: boolean;
}): Promise<AttachResult> {
  const admin = getAgentAdmin();
  if (!admin) return { ok: false, error: "server-misconfigured" };
  const { data, error } = await admin.rpc("agent_attach_receipt", {
    p_actor: args.actorId,
    p_expense_id: args.expenseId,
    p_receipt_path: args.receiptPath,
    p_items: args.draft?.items ?? null,
    p_merchant_ko: args.draft?.merchantKo ?? null,
    p_clear_payment_method: args.clearPaymentMethod ?? false,
    p_event_id: args.eventId,
  });
  if (error) return { ok: false, error: error.message };
  const row = (data ?? {}) as { attached?: boolean; reason?: string };
  return { ok: true, attached: row.attached === true, reason: row.reason };
}

type ReceiptImageOutcome =
  | { ok: true; draft: ExpenseDraftInput; path: string }
  | {
      ok: false;
      status: "needs_review" | "ignored";
      reason: string;
      message: string;
    };

const RECEIPT_UNREADABLE_MESSAGE = "영수증을 읽지 못했어요";

function isOwnUploadPath(path: unknown, userId: string): path is string {
  return (
    typeof path === "string" &&
    path.startsWith(`${userId}/`) &&
    !path.includes("..") &&
    !path.includes("\\")
  );
}

/**
 * agent-uploads 의 사진을 내려받아 vision 으로 읽고 공통 초안으로 바꾼다.
 * 실패해도 던지지 않고 사유를 돌려준다 (이벤트는 needs_review 로 남는다).
 * 이미지 원본·추출 전문은 로그에 남기지 않는다.
 */
async function readReceiptImage(args: {
  userId: string;
  tripId: string;
  payload: Record<string, unknown>;
  tripCurrency: string | null | undefined;
}): Promise<ReceiptImageOutcome> {
  const admin = getAgentAdmin();
  const unreadable = (reason: string): ReceiptImageOutcome => ({
    ok: false,
    status: "needs_review",
    reason,
    message: RECEIPT_UNREADABLE_MESSAGE,
  });
  if (!admin) return unreadable("receipt_server_misconfigured");

  const path = args.payload.path;
  if (!isOwnUploadPath(path, args.userId)) {
    return unreadable("receipt_bad_path");
  }

  const { data: blob, error: dlError } = await admin.storage
    .from("agent-uploads")
    .download(path);
  if (dlError || !blob) {
    console.error("[processEvent] receipt download failed", dlError?.message);
    return unreadable("receipt_download_failed");
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = detectImageMime(bytes);
  if (!mime) return unreadable("receipt_unsupported_image");

  const vision = await extractReceiptFromImage({
    base64: Buffer.from(bytes).toString("base64"),
    mime,
    userId: args.userId,
    tripId: args.tripId,
    hintCurrency: args.tripCurrency,
  });

  if (!vision.ok) {
    if (vision.error === "not_receipt") {
      return {
        ok: false,
        status: "ignored",
        reason: "not_receipt",
        message: "영수증이 아니어서 건너뛰었어요",
      };
    }
    console.error("[processEvent] receipt vision failed", vision.error, vision.detail);
    return unreadable(`receipt_${vision.error}`);
  }

  const base = receiptDraftToExpenseDraft(vision.draft, vision.extract);
  return {
    ok: true,
    path,
    draft: {
      ...base,
      // 영수증에 시각이 없으면 추정값(12:00)으로 시각 비교를 하지 않는다.
      paidAt: base.timeIsEstimated ? null : base.paidAt,
    },
  };
}

function duplicateSignals(
  dupes: DuplicateCandidate[],
  existing: Array<{ id: string; spentOn: string }>,
  receiptAttached: Set<string>
) {
  return dupes.map((d) => ({
    expenseId: d.expenseId,
    score: d.score,
    spentOn: existing.find((e) => e.id === d.expenseId)?.spentOn ?? null,
    strong: isReceiptStrongCandidate(d),
    receiptAttached: receiptAttached.has(d.expenseId),
    timeKnown: d.reasons.includes("within_30min"),
    merchantSimilar: d.reasons.includes("merchant_similar"),
  }));
}

/**
 * Event orchestrator. Safe to call twice (idempotent saves).
 */
export async function processEvent(eventId: string): Promise<void> {
  const admin = getAgentAdmin();
  if (!admin) {
    console.error("[processEvent] admin client missing");
    return;
  }

  let seq = 0;
  try {
    const { data: claimed, error: claimError } = await admin.rpc(
      "agent_claim_event",
      { p_event_id: eventId, p_stale_seconds: 120 }
    );

    if (claimError) {
      console.error("[processEvent] claim failed", claimError.message);
      return;
    }
    if (!claimed || (Array.isArray(claimed) && claimed.length === 0)) {
      return;
    }

    const event = (
      Array.isArray(claimed) ? claimed[0] : claimed
    ) as EventRow;
    if (!event?.id || !event.user_id) {
      return;
    }

    const domainFollowUpIds: string[] = [];

    // Notification-first: attach by received_at window, else leave unassigned.
    if (!event.trip_id) {
      const receivedMs = parseReceivedAtMs(
        event.payload as Record<string, unknown> | null,
        event.created_at
      );
      const resolved = await pickTripForReceivedAt(
        event.user_id,
        new Date(receivedMs)
      );
      if (resolved) {
        await admin
          .from("agent_events")
          .update({ trip_id: resolved, status: "processing" })
          .eq("id", event.id);
        event.trip_id = resolved;
      } else {
        await admin
          .from("agent_events")
          .update({
            status: "unassigned",
            result: { reason: "unassigned" },
            error: null,
            processed_at: null,
            locked_at: null,
          })
          .eq("id", event.id);
        await recordStep(
          event.id,
          seq++,
          "unassigned",
          {},
          { message: "기간이 맞는 여행이 생기면 자동으로 붙여요" },
          0,
          true
        );
        return;
      }
    }

    const ctx = await loadCtx(event.trip_id, event.user_id);
    if (!ctx?.ownerMember) {
      await admin
        .from("agent_events")
        .update({
          status: "failed",
          error: "no-owner-member",
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      return;
    }

    const payload = event.payload ?? {};

    if (event.kind === "domain") {
      const domainType =
        typeof payload.type === "string" ? payload.type : "";
      if (domainType === "expense_changed") {
        const settlement = await onExpenseChanged({
          tripId: event.trip_id,
          ownerUserId: ctx.trip.user_id,
          eventId: event.id,
          payload,
        });
        await admin
          .from("agent_events")
          .update({
            status: "done",
            result: settlement,
            processed_at: new Date().toISOString(),
            error: null,
          })
          .eq("id", event.id);
        return;
      }
      await admin
        .from("agent_events")
        .update({
          status: "ignored",
          result: { reason: "unsupported_domain_type", type: domainType },
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      return;
    }

    const text = preferSmsParseText(payload);

    let drafts: ExpenseDraftInput[] = [];
    let receiptPath: string | null = null;
    if (event.kind === "sms" || event.kind === "text") {
      const t0 = Date.now();
      drafts = extractTextDrafts(text, {
        today: todayKst(),
        tripStart: ctx.trip.start_date,
        tripEnd: ctx.trip.end_date,
      });
      await recordStep(
        event.id,
        ++seq,
        "extractTextDrafts",
        { len: text.length },
        { count: drafts.length },
        Date.now() - t0,
        true
      );
    } else if (event.kind === "image") {
      const t0 = Date.now();
      const read = await readReceiptImage({
        userId: event.user_id,
        tripId: event.trip_id,
        payload,
        tripCurrency: ctx.trip.currency,
      });
      await recordStep(
        event.id,
        ++seq,
        "receiptVision",
        {},
        read.ok
          ? { ok: true, hasAmount: read.draft.amount != null }
          : { ok: false, reason: read.reason },
        Date.now() - t0,
        read.ok
      );
      if (!read.ok) {
        await admin
          .from("agent_events")
          .update({
            status: read.status,
            result: { reason: read.reason, message: read.message, items: [] },
            error: null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", event.id);
        return;
      }
      drafts = [read.draft];
      receiptPath = read.path;
    } else {
      await admin
        .from("agent_events")
        .update({
          status: "ignored",
          result: { reason: "unsupported_kind" },
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      return;
    }

    if (drafts.length === 0) {
      await admin
        .from("agent_events")
        .update({
          status: "ignored",
          result: { reason: "empty_drafts" },
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      return;
    }

    const { data: existingRows } = await admin
      .from("trip_expenses")
      .select(
        "id, currency, amount, merchant, spent_on, krw_amount, paid_at, status, source, receipt_path, source_event_id"
      )
      .eq("trip_id", event.trip_id)
      .neq("status", "voided")
      .order("created_at", { ascending: false })
      .limit(200);

    // 이 이벤트가 이미 저장한 지출(재처리)은 중복 후보에서 뺀다 — 저장은 멱등 키로 같은 id 를 돌려준다.
    const priorRows = (existingRows ?? []).filter(
      (e) => (e.source_event_id as string | null) !== event.id
    );
    const receiptAttached = new Set<string>(
      priorRows
        .filter((e) => typeof e.receipt_path === "string" && e.receipt_path)
        .map((e) => e.id as string)
    );
    const existing = priorRows.map((e) => ({
      id: e.id as string,
      currency: String(e.currency ?? "KRW"),
      amount: Number(e.amount ?? 0),
      merchant: String(e.merchant ?? ""),
      spentOn: String(e.spent_on ?? ""),
      krwAmount: Number(e.krw_amount ?? 0),
      paidAt: (e.paid_at as string | null) ?? null,
      source: (e.source as string | null) ?? null,
    }));

    let autoCountToday = await countAutoToday(event.user_id, event.trip_id);
    const env = policyEnvFromProcess(ctx.ownerMember.id);
    const items: Array<Record<string, unknown>> = [];
    let anyReview = false;
    let anyFailedCommit = false;
    let allIgnore = true;

    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i]!;

      // Non-payment / garbage SMS → ignore without review spam
      if (
        (draft.kind === "unknown" || draft.kind == null) &&
        (draft.confidence ?? 0) < 0.3 &&
        (draft.amount == null || !draft.currency)
      ) {
        items.push({
          ref: i,
          decision: "ignore",
          reasons: ["결제 문자가 아니어서 건너뛰었어요"],
        });
        continue;
      }

      const tPrice = Date.now();
      const priced = (await priceDraft(
        draft,
        ctx.ownerMember.id,
        ctx.members
      )) as PricedWithMeta | null;
      await recordStep(
        event.id,
        ++seq,
        "priceDraft",
        { index: i },
        priced
          ? { krw: priced.krwAmount, currency: priced.currency }
          : { ok: false },
        Date.now() - tPrice,
        Boolean(priced)
      );

      if (!priced) {
        anyReview = true;
        allIgnore = false;
        items.push({
          ref: i,
          decision: "review",
          reasons: ["금액·통화를 읽지 못했어요"],
          draft,
        });
        continue;
      }

      const dupes = findDuplicateCandidates(
        {
          currency: priced.currency,
          amount: priced.amount,
          merchant: priced.__merchant ?? draft.merchant ?? "",
          spentOn: draft.spentOn ?? "",
          krwAmount: priced.krwAmount,
          paidAt: draft.paidAt,
          kind: draft.kind,
          source: draft.source === "receipt" ? "receipt" : null,
          timeIsEstimated: draft.timeIsEstimated,
        },
        existing
      );

      const decision = decide(
        priced,
        {
          duplicateCandidates: duplicateSignals(dupes, existing, receiptAttached),
          autoCountToday,
        },
        env
      );

      await recordStep(
        event.id,
        ++seq,
        "decide",
        { index: i },
        decision,
        0,
        true
      );

      if (decision.decision === "ignore") {
        items.push({
          ref: i,
          decision: "ignore",
          reasons: decision.reasons,
        });
        continue;
      }

      allIgnore = false;

      let reviewReasons = decision.reasons;
      let mergeInto: string | undefined = decision.duplicateOfExpenseId;

      if (decision.decision === "merge") {
        // Same payment already recorded: attach the receipt, never create a 2nd expense.
        const target = decision.mergeExpenseId;
        const tMerge = Date.now();
        const attached =
          target && receiptPath
            ? await attachReceipt({
                actorId: event.user_id,
                expenseId: target,
                receiptPath,
                eventId: event.id,
                draft,
              })
            : ({ ok: false, error: "no-target" } as const);
        await recordStep(
          event.id,
          ++seq,
          "attachReceipt",
          { index: i, expenseId: target ?? null },
          attached.ok
            ? { attached: attached.attached, reason: attached.reason ?? null }
            : { ok: false },
          Date.now() - tMerge,
          attached.ok && attached.attached
        );
        if (attached.ok && attached.attached && target) {
          receiptAttached.add(target);
          items.push({
            ref: i,
            decision: "merged",
            expenseId: target,
            reasons: decision.reasons,
          });
          continue;
        }
        // Could not attach (already has a receipt, RPC error …): leave it to the user.
        if (!attached.ok) {
          console.error("[processEvent] attach receipt failed", attached.error);
        }
        reviewReasons = ["이미 같은 결제가 있어요 — 합치기/별개로 저장"];
        mergeInto = target;
      }

      if (decision.decision === "auto_commit") {
        const expenseId = await commitExpense({
          actorId: event.user_id,
          tripId: event.trip_id,
          eventId: event.id,
          index: i,
          priced,
          draft,
          reasons: decision.reasons,
          status: "auto",
          receiptPath,
        });

        if (!expenseId) {
          anyFailedCommit = true;
          anyReview = true;
          items.push({
            ref: i,
            decision: "review",
            reasons: ["저장에 실패했어요. 다시 시도하거나 직접 확인해 주세요"],
            draft,
          });
          continue;
        }

        autoCountToday += 1;
        existing.unshift({
          id: expenseId,
          currency: priced.currency,
          amount: priced.amount,
          merchant: priced.__merchant ?? draft.merchant ?? "",
          spentOn: draft.spentOn ?? "",
          krwAmount: priced.krwAmount,
          paidAt: draft.paidAt ?? null,
          source: draft.source === "receipt" ? "receipt" : "sms",
        });
        if (receiptPath) receiptAttached.add(expenseId);

        items.push({
          ref: i,
          decision: "auto_commit",
          expenseId,
          reasons: decision.reasons,
        });

        const domainCreated = await createEvent({
          userId: event.user_id,
          tripId: event.trip_id,
          source: "domain",
          kind: "domain",
          payload: { type: "expense_changed", expenseId },
          idempotencyKey: `expense_changed:${event.trip_id}:${expenseId}`,
        });
        pushFollowUpEventId(domainFollowUpIds, domainCreated);
        await notifyUsers({
          userIds: [event.user_id],
          type: "expense_added",
          tripId: event.trip_id,
          actorId: event.user_id,
          payload: {
            expenseId,
            krwAmount: priced.krwAmount,
            merchant: priced.__merchant ?? draft.merchant,
          },
          dedupeKey: `expense_added:${expenseId}`,
        });
        continue;
      }

      anyReview = true;
      items.push({
        ref: i,
        decision: "review",
        reasons: reviewReasons,
        ...(mergeInto ? { mergeInto } : {}),
        draft,
        priced: {
          krwAmount: priced.krwAmount,
          currency: priced.currency,
          amount: priced.amount,
        },
      });
      await notifyUsers({
        userIds: [event.user_id],
        type: "expense_review",
        tripId: event.trip_id,
        actorId: event.user_id,
        payload: { eventId: event.id, index: i, reasons: reviewReasons },
        dedupeKey: `expense_review:${event.id}:${i}`,
      });
    }

    const status = anyFailedCommit
      ? "failed"
      : allIgnore
        ? "ignored"
        : anyReview
          ? "needs_review"
          : "done";

    await admin
      .from("agent_events")
      .update({
        status,
        result: { items },
        processed_at: new Date().toISOString(),
        error: anyFailedCommit ? "commit-failed" : null,
      })
      .eq("id", event.id);

    await runDomainFollowUps(event.kind, domainFollowUpIds, processEvent);
  } catch (err) {
    console.error("[processEvent]", err);
    await admin
      .from("agent_events")
      .update({
        status: "failed",
        error: err instanceof Error ? err.message : "process-failed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventId);
  }
}

type ResultItem = {
  ref?: number;
  decision?: string;
  draft?: ExpenseDraftInput;
  expenseId?: string;
  reasons?: string[];
  /** 같은 결제로 보이는 기존 지출 (영수증 합치기 후보) */
  mergeInto?: string;
};

/**
 * Manual confirm for needs_review items (P15 inbox).
 * mode "merge": 영수증을 기존 지출에 붙이고 새 지출은 만들지 않는다.
 * mode 생략/"separate": 새 지출로 저장한다.
 */
export async function confirmEventReviews(
  eventId: string,
  actorId: string,
  input?: {
    items?: Array<{ index: number; draft?: ExpenseDraftInput }>;
    mode?: "merge" | "separate";
  }
): Promise<
  | { ok: true; expenseIds: string[]; status: string }
  | { ok: false; error: string }
> {
  const admin = getAgentAdmin();
  if (!admin) return { ok: false, error: "server-misconfigured" };

  const { data: row, error: loadErr } = await admin
    .from("agent_events")
    .select("id, user_id, trip_id, kind, payload, status, result")
    .eq("id", eventId)
    .maybeSingle();

  if (loadErr || !row) return { ok: false, error: "not-found" };
  if (row.user_id !== actorId) return { ok: false, error: "forbidden" };
  if (row.status !== "needs_review" && row.status !== "failed") {
    return { ok: false, error: "bad-status" };
  }
  if (!row.trip_id || typeof row.trip_id !== "string") {
    return { ok: false, error: "awaiting-trip" };
  }

  const result = (row.result ?? {}) as { items?: ResultItem[] };
  const items = Array.isArray(result.items) ? [...result.items] : [];
  const reviewRefs = new Set(
    items
      .filter((it) => it.decision === "review")
      .map((it) => Number(it.ref))
      .filter((n) => !Number.isNaN(n))
  );

  const commits: Array<{ index: number; draft?: ExpenseDraftInput }> =
    input?.items?.length
      ? input.items
      : [...reviewRefs].map((index) => ({ index }));

  if (commits.length === 0) {
    return { ok: false, error: "nothing-to-confirm" };
  }

  const ctx = await loadCtx(row.trip_id, actorId);
  if (!ctx?.ownerMember) return { ok: false, error: "no-owner-member" };

  const expenseIds: string[] = [];
  // 경로는 서버가 만든 payload 에서만 읽는다 (클라이언트 입력 불가).
  const rowPayload = (row.payload ?? {}) as Record<string, unknown>;
  const receiptPath =
    row.kind === "image" && isOwnUploadPath(rowPayload.path, actorId)
      ? rowPayload.path
      : null;

  for (const commit of commits) {
    const idx = commit.index;
    const existing = items.find((it) => Number(it.ref) === idx);

    if (input?.mode === "merge") {
      const target = existing?.mergeInto;
      if (!target || !receiptPath) continue;
      const attached = await attachReceipt({
        actorId,
        expenseId: target,
        receiptPath,
        eventId,
        draft: existing?.draft,
      });
      // 이미 다른 영수증이 붙어 있어도(attached=false) 새 지출은 만들지 않는다.
      if (!attached.ok) {
        console.error("[confirmEventReviews] attach failed", attached.error);
        continue;
      }
      expenseIds.push(target);
      const mergedPos = items.findIndex((it) => Number(it.ref) === idx);
      const merged: ResultItem = {
        ref: idx,
        decision: "merged",
        expenseId: target,
        reasons: ["사용자가 같은 결제로 합쳤어요"],
      };
      if (mergedPos >= 0) items[mergedPos] = merged;
      else items.push(merged);
      continue;
    }
    const draft =
      commit.draft ??
      (existing?.draft as ExpenseDraftInput | undefined);
    if (!draft) continue;

    const priced = (await priceDraft(
      draft,
      ctx.ownerMember.id,
      ctx.members
    )) as PricedWithMeta | null;
    if (!priced) continue;

    const expenseId = await commitExpense({
      actorId,
      tripId: row.trip_id as string,
      eventId,
      index: idx,
      priced,
      draft,
      reasons: existing?.reasons ?? ["inbox_confirm"],
      status: "confirmed",
      receiptPath,
    });
    if (!expenseId) continue;

    expenseIds.push(expenseId);
    const pos = items.findIndex((it) => Number(it.ref) === idx);
    const next: ResultItem = {
      ref: idx,
      decision: "auto_commit",
      expenseId,
      reasons: existing?.reasons ?? ["inbox_confirm"],
    };
    if (pos >= 0) items[pos] = next;
    else items.push(next);
  }

  if (expenseIds.length === 0) {
    return { ok: false, error: "commit-failed" };
  }

  const stillReview = items.some((it) => it.decision === "review");
  const nextStatus = stillReview ? "needs_review" : "done";

  await admin
    .from("agent_events")
    .update({
      status: nextStatus,
      result: { items },
      error: null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  return { ok: true, expenseIds, status: nextStatus };
}
