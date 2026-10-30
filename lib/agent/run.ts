import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import { createEvent } from "@/lib/agent/ingest";
import { extractTextDrafts } from "@/lib/agent/extract-text";
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
} from "@/lib/ledger/dedupe";
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
}): Promise<string | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;

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
    payment_method: "card",
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
    source: "sms",
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
  return data as string;
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
      // P12: vision — for now park as review
      await admin
        .from("agent_events")
        .update({
          status: "needs_review",
          result: { reason: "receipt_pending_p12", drafts: [] },
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      return;
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
        "id, currency, amount, merchant, spent_on, krw_amount, paid_at, status"
      )
      .eq("trip_id", event.trip_id)
      .neq("status", "voided")
      .order("created_at", { ascending: false })
      .limit(200);

    const existing = (existingRows ?? []).map((e) => ({
      id: e.id as string,
      currency: String(e.currency ?? "KRW"),
      amount: Number(e.amount ?? 0),
      merchant: String(e.merchant ?? ""),
      spentOn: String(e.spent_on ?? ""),
      krwAmount: Number(e.krw_amount ?? 0),
      paidAt: (e.paid_at as string | null) ?? null,
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
        },
        existing
      );

      const decision = decide(
        priced,
        {
          duplicateCandidates: dupes.map((d) => ({
            expenseId: d.expenseId,
            score: d.score,
            spentOn:
              existing.find((e) => e.id === d.expenseId)?.spentOn ?? null,
          })),
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
        });

        items.push({
          ref: i,
          decision: "auto_commit",
          expenseId,
          reasons: decision.reasons,
        });

        await createEvent({
          userId: event.user_id,
          tripId: event.trip_id,
          source: "domain",
          kind: "domain",
          payload: { type: "expense_changed", expenseId },
          idempotencyKey: `expense_changed:${event.trip_id}:${expenseId}`,
        });
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
        reasons: decision.reasons,
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
        payload: { eventId: event.id, index: i, reasons: decision.reasons },
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
};

/** Manual confirm for needs_review items (P15 inbox). */
export async function confirmEventReviews(
  eventId: string,
  actorId: string,
  input?: { items?: Array<{ index: number; draft?: ExpenseDraftInput }> }
): Promise<
  | { ok: true; expenseIds: string[]; status: string }
  | { ok: false; error: string }
> {
  const admin = getAgentAdmin();
  if (!admin) return { ok: false, error: "server-misconfigured" };

  const { data: row, error: loadErr } = await admin
    .from("agent_events")
    .select("id, user_id, trip_id, status, result")
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

  for (const commit of commits) {
    const idx = commit.index;
    const existing = items.find((it) => Number(it.ref) === idx);
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
