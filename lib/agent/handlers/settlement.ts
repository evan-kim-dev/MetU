import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import { createEvent } from "@/lib/agent/ingest";
import {
  planSettlementAction,
  type OpenSettlementState,
  type TripPhase,
} from "@/lib/agent/handlers/settlement-plan";
import { notifyUsers } from "@/lib/agent/notify";
import { fetchLedger } from "@/lib/ledger/supabase";
import {
  basisHash,
  computeBalances,
  minimizeTransfers,
  type LedgerExpense,
} from "@/lib/ledger/settle";

export type SettlementRunResult = {
  action: string;
  reasons: string[];
  coalesced?: boolean;
  settlementId?: string | null;
};

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseKstDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T12:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function tripPhase(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: string
): TripPhase {
  const end = endDate ?? startDate;
  if (end && end < today) return "ended";
  return "ongoing";
}

function daysSinceEnd(endDate: string | null | undefined, today: string): number {
  const end = parseKstDate(endDate);
  const now = parseKstDate(today);
  if (!end || !now) return 0;
  return Math.floor((now.getTime() - end.getTime()) / (24 * 60 * 60 * 1000));
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function coalesceSec(): number {
  return envInt("AGENT_SETTLE_COALESCE_SEC", 300);
}

function reviewHoldDays(): number {
  return envInt("AGENT_SETTLE_REVIEW_HOLD_DAYS", 3);
}

async function pendingReviewCount(tripId: string): Promise<number> {
  const admin = getAgentAdmin();
  if (!admin) return 0;
  const { count } = await admin
    .from("agent_events")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("status", "needs_review");
  return count ?? 0;
}

async function loadOpenSettlement(
  tripId: string
): Promise<OpenSettlementState | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;

  const { data: row } = await admin
    .from("trip_settlements")
    .select("id, basis_hash, status")
    .eq("trip_id", tripId)
    .in("status", ["open", "stale"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row?.id) return null;

  const { data: paidRows } = await admin
    .from("trip_settlement_transfers")
    .select("id")
    .eq("settlement_id", row.id)
    .eq("status", "paid")
    .limit(1);

  return {
    basisHash: String(row.basis_hash ?? ""),
    hasPaid: (paidRows?.length ?? 0) > 0,
    status: row.status as OpenSettlementState["status"],
  };
}

async function lastSettlementRefreshMs(tripId: string): Promise<number | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("trip_settlements")
    .select("created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.created_at) return null;
  const t = new Date(String(data.created_at)).getTime();
  return Number.isNaN(t) ? null : t;
}

async function memberUserIds(tripId: string): Promise<string[]> {
  const admin = getAgentAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.user_id) ids.add(String(row.user_id));
  }
  return [...ids];
}

async function computeTripSettlementBasis(tripId: string): Promise<{
  basis: string;
  transfers: Array<{ from: string; to: string; krw: number }>;
} | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;

  const snap = await fetchLedger(admin, tripId);
  if (!snap) return null;

  const { data: voidedRows } = await admin
    .from("trip_expenses")
    .select("id")
    .eq("trip_id", tripId)
    .eq("status", "voided");
  const voided = new Set((voidedRows ?? []).map((r) => String(r.id)));

  const memberIds = snap.members.map((m) => m.id);
  const ledgerExpenses: LedgerExpense[] = snap.expenses
    .filter((e) => !voided.has(e.id))
    .map((e) => ({
      id: e.id,
      paidBy: e.paidBy,
      krwAmount: e.krwAmount,
      shares: e.shares,
    }));

  const hash = await basisHash(ledgerExpenses);
  const balances = computeBalances(memberIds, ledgerExpenses);
  const transfers = minimizeTransfers(balances).map((t) => ({
    from: t.from,
    to: t.to,
    krw: t.krw,
  }));

  return { basis: hash, transfers };
}

async function markSettlementStale(tripId: string): Promise<void> {
  const admin = getAgentAdmin();
  if (!admin) return;
  await admin
    .from("trip_settlements")
    .update({ status: "stale" })
    .eq("trip_id", tripId)
    .eq("status", "open");
}

async function createAutoProposal(
  ownerUserId: string,
  tripId: string,
  basis: string,
  transfers: Array<{ from: string; to: string; krw: number }>
): Promise<string | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;

  const { data, error } = await admin.rpc("agent_create_settlement", {
    p_actor: ownerUserId,
    p_trip_id: tripId,
    p_mode: "auto",
    p_basis_hash: basis,
    p_transfers: transfers,
  });

  if (error) {
    console.error("[createAutoProposal]", error.message);
    return null;
  }
  return data as string;
}

async function scheduleCoalesceFlush(
  ownerUserId: string,
  tripId: string,
  now: number
): Promise<void> {
  const sec = coalesceSec();
  const bucket = Math.floor(now / (sec * 1000));
  await createEvent({
    userId: ownerUserId,
    tripId,
    source: "domain",
    kind: "domain",
    payload: { type: "expense_changed", flush: true },
    idempotencyKey: `settle_refresh:${tripId}:${bucket}`,
  });
}

async function shouldCoalesceEvent(
  tripId: string,
  eventId: string,
  payload: Record<string, unknown>,
  now: number
): Promise<boolean> {
  if (payload.flush === true) return false;

  const admin = getAgentAdmin();
  if (!admin) return false;

  const sec = coalesceSec();
  const bucket = Math.floor(now / (sec * 1000));
  const key = `settle_refresh:${tripId}:${bucket}`;

  const { data: flushRow } = await admin
    .from("agent_events")
    .select("id, status")
    .eq("idempotency_key", key)
    .maybeSingle();

  if (flushRow?.id && flushRow.id !== eventId) {
    return flushRow.status === "received" || flushRow.status === "processing";
  }

  const since = new Date(now - sec * 1000).toISOString();
  const { data: recent } = await admin
    .from("agent_events")
    .select("id, result")
    .eq("trip_id", tripId)
    .eq("kind", "domain")
    .eq("status", "done")
    .neq("id", eventId)
    .gte("processed_at", since)
    .limit(20);

  return (recent ?? []).some(
    (row) =>
      row.result &&
      typeof row.result === "object" &&
      (row.result as { settlementApplied?: boolean }).settlementApplied ===
        true
  );
}

export async function evaluateTripSettlement(
  tripId: string,
  options?: { now?: number; trigger?: "expense" | "daily" }
): Promise<SettlementRunResult> {
  const admin = getAgentAdmin();
  if (!admin) {
    return { action: "none", reasons: ["no-admin"] };
  }

  const now = options?.now ?? Date.now();
  const today = todayKst();

  const { data: trip } = await admin
    .from("trips")
    .select("id, user_id, start_date, end_date, auto_settle")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip?.user_id) {
    return { action: "none", reasons: ["trip-not-found"] };
  }

  const ownerUserId = String(trip.user_id);
  const autoSettle = Boolean(trip.auto_settle);
  const phase = tripPhase(trip.start_date, trip.end_date, today);
  const openSettlement = await loadOpenSettlement(tripId);
  const pending = await pendingReviewCount(tripId);
  const lastRefreshAt = await lastSettlementRefreshMs(tripId);

  const basisPayload = await computeTripSettlementBasis(tripId);
  const currentBasisHash = basisPayload?.basis ?? "";

  const plan = planSettlementAction({
    autoSettle,
    tripPhase: phase,
    openSettlement,
    currentBasisHash,
    pendingReviewCount: pending,
    daysSinceEnd: daysSinceEnd(trip.end_date ?? trip.start_date, today),
    lastRefreshAt,
    now,
    coalesceSec: coalesceSec(),
    reviewHoldDays: reviewHoldDays(),
  });

  const result: SettlementRunResult = {
    action: plan.action,
    reasons: plan.reasons,
  };

  const memberUsers = await memberUserIds(tripId);

  switch (plan.action) {
    case "none":
    case "notify_preview_only":
      return result;

    case "owner_nudge": {
      await notifyUsers({
        userIds: [ownerUserId],
        type: "settlement_ready",
        tripId,
        payload: {
          variant: "owner_nudge",
          message:
            "여행이 끝났어요. 정산표를 직접 만들거나 자동 정산 제안을 켜 주세요.",
        },
        dedupeKey: `trip_ended_nudge:${tripId}`,
      });
      return result;
    }

    case "hold_for_review": {
      await notifyUsers({
        userIds: [ownerUserId],
        type: "settlement_ready",
        tripId,
        payload: {
          variant: "hold",
          pendingReviewCount: pending,
          message: `확인 대기 ${pending}건이 있어서 정산 제안을 잠깐 미뤘어요`,
        },
        dedupeKey: `trip_hold:${tripId}:${today}`,
      });
      return result;
    }

    case "mark_stale": {
      await markSettlementStale(tripId);
      await notifyUsers({
        userIds: [ownerUserId],
        type: "settlement_stale",
        tripId,
        payload: {
          message:
            "이미 송금 표시가 있어서 자동으로 바꾸지 않았어요. 정산표를 다시 계산해 주세요.",
        },
        dedupeKey: `settlement_stale:${tripId}:${currentBasisHash.slice(0, 12)}`,
      });
      return result;
    }

    case "create_proposal":
    case "recreate_proposal": {
      if (!basisPayload) {
        return { action: "none", reasons: ["basis-unavailable"] };
      }
      const settlementId = await createAutoProposal(
        ownerUserId,
        tripId,
        basisPayload.basis,
        basisPayload.transfers
      );
      result.settlementId = settlementId;

      const dedupe =
        options?.trigger === "daily"
          ? `trip_ended:${tripId}`
          : `settlement_ready:${tripId}:${basisPayload.basis.slice(0, 16)}`;

      await notifyUsers({
        userIds: memberUsers,
        type: "settlement_ready",
        tripId,
        payload: {
          settlementId,
          message:
            options?.trigger === "daily"
              ? "여행이 끝났어요. 정산 제안이 준비됐어요. 금액을 확인하고 직접 송금해 주세요."
              : "정산 제안 금액이 바뀌었어요. 송금은 직접 해 주세요.",
        },
        dedupeKey: dedupe,
      });
      return result;
    }

    default:
      return result;
  }
}

export async function onExpenseChanged(args: {
  tripId: string;
  ownerUserId: string;
  eventId: string;
  payload?: Record<string, unknown>;
}): Promise<SettlementRunResult & { settlementApplied?: boolean }> {
  const now = Date.now();
  const payload = args.payload ?? {};

  if (
    await shouldCoalesceEvent(args.tripId, args.eventId, payload, now)
  ) {
    await scheduleCoalesceFlush(args.ownerUserId, args.tripId, now);
    return {
      action: "none",
      reasons: ["coalesced"],
      coalesced: true,
      settlementApplied: false,
    };
  }

  const result = await evaluateTripSettlement(args.tripId, {
    now,
    trigger: "expense",
  });

  const applied =
    result.action === "create_proposal" ||
    result.action === "recreate_proposal" ||
    result.action === "mark_stale";

  return { ...result, settlementApplied: applied };
}

export async function runDailySettlementCron(): Promise<{
  processed: number;
  results: Array<{ tripId: string; action: string }>;
}> {
  const admin = getAgentAdmin();
  if (!admin) return { processed: 0, results: [] };

  const today = todayKst();
  const { data: trips, error } = await admin
    .from("trips")
    .select("id, user_id, end_date, start_date, auto_settle")
    .not("end_date", "is", null)
    .lt("end_date", today)
    .limit(200);

  if (error) {
    console.error("[runDailySettlementCron]", error.message);
    return { processed: 0, results: [] };
  }

  const results: Array<{ tripId: string; action: string }> = [];

  for (const trip of trips ?? []) {
    const tripId = String(trip.id);

    const { count: settlementCount } = await admin
      .from("trip_settlements")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId);
    if ((settlementCount ?? 0) > 0) {
      continue;
    }

    const r = await evaluateTripSettlement(tripId, {
      trigger: "daily",
      now: Date.now(),
    });
    results.push({ tripId, action: r.action });
  }

  return { processed: results.length, results };
}
