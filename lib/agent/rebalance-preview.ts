import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import {
  proposeScheduleAfterCardNotify,
  type CardNotifyScheduleProposal,
} from "@/lib/agent/card-notify-schedule";
import {
  budgetPlanFromAllocation,
  planItemsFromDailySchedule,
} from "@/lib/budget/adapters";
import type { PlanItem } from "@/lib/budget/types";
import { TABLES } from "@/lib/constants";

type AllocRow = {
  id: string;
  label: string;
  amount: number;
  percent?: number;
};

type DayRow = {
  day: number;
  items: Array<{
    time: string;
    title: string;
    cost: number;
    category?: string;
  }>;
};

export type TripRebalancePreview = {
  shouldSuggest: boolean;
  message: string;
  adjustmentsLog: string[];
  overCategories: string[];
  remainingBudgetKrw: number;
  remainingScheduleEstKrw: number;
  gapKrw: number;
  droppedCount: number;
  adjustedItems: PlanItem[];
  planVersion: number;
  openSuggestionId: string | null;
};

type TripCtx = {
  planVersion: number;
  proposal: CardNotifyScheduleProposal;
  openSuggestionId: string | null;
};

async function loadTripRebalanceCtx(tripId: string): Promise<TripCtx | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;

  const { data: openExisting } = await admin
    .from(TABLES.tripSuggestions)
    .select("id")
    .eq("trip_id", tripId)
    .eq("type", "rebalance")
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  const { data: trip } = await admin
    .from(TABLES.trips)
    .select("id, people, budget, budget_allocation, daily_schedule")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return null;

  const allocation = Array.isArray(trip.budget_allocation)
    ? (trip.budget_allocation as AllocRow[])
    : [];
  const total =
    typeof trip.budget === "number" && Number.isFinite(trip.budget)
      ? Math.trunc(trip.budget)
      : allocation.reduce(
          (s, a) => s + Math.max(0, Math.trunc(a.amount) || 0),
          0
        );

  const plan = budgetPlanFromAllocation({
    tripId,
    total,
    people: typeof trip.people === "number" ? trip.people : 1,
    allocation,
  });

  const schedule = Array.isArray(trip.daily_schedule)
    ? (trip.daily_schedule as DayRow[])
    : [];
  const remainingItems = planItemsFromDailySchedule({
    tripId,
    dailySchedule: schedule,
  });

  const { data: expenseRows } = await admin
    .from(TABLES.tripExpenses)
    .select("category, krw_amount, spent_on, status")
    .eq("trip_id", tripId)
    .in("status", ["confirmed", "auto"]);

  const expenses = (expenseRows ?? []).map((e) => ({
    category: String(e.category ?? "etc"),
    krwAmount: Math.max(0, Math.trunc(Number(e.krw_amount) || 0)),
    occurredOn: typeof e.spent_on === "string" ? e.spent_on : null,
  }));

  const proposal = proposeScheduleAfterCardNotify({
    plan,
    expenses,
    remainingItems,
  });

  return {
    planVersion: plan.version,
    proposal,
    openSuggestionId: openExisting?.id ? String(openExisting.id) : null,
  };
}

function toPreview(ctx: TripCtx): TripRebalancePreview {
  const { proposal, planVersion, openSuggestionId } = ctx;
  return {
    shouldSuggest: proposal.shouldSuggest,
    message: proposal.message,
    adjustmentsLog: proposal.adjustmentsLog,
    overCategories: proposal.overCategories,
    remainingBudgetKrw: proposal.remainingBudgetKrw,
    remainingScheduleEstKrw: proposal.remainingScheduleEstKrw,
    gapKrw: proposal.gapKrw,
    droppedCount: proposal.dropped.length,
    adjustedItems: proposal.adjustedItems,
    planVersion,
    openSuggestionId,
  };
}

/** 일정 확인 UI용 — 일정 JSON 은 바꾸지 않아요. */
export async function previewTripRebalance(
  tripId: string
): Promise<TripRebalancePreview | null> {
  const ctx = await loadTripRebalanceCtx(tripId);
  if (!ctx) return null;
  return toPreview(ctx);
}

export type EnsureRebalanceSuggestionResult =
  | {
      ok: true;
      suggestionId: string;
      created: boolean;
      preview: TripRebalancePreview;
    }
  | { ok: false; error: string; preview?: TripRebalancePreview };

/**
 * 최신 조정안으로 open rebalance Suggestion 을 확보해요.
 * 이미 open 이 있으면 dismiss 한 뒤 새로 만들어 미리보기와 수락 payload 를 맞춰요.
 */
export async function ensureOpenRebalanceSuggestion(args: {
  tripId: string;
  actorUserId: string;
  /** true 면 기존 open 을 닫고 최신으로 다시 만들어요 (apply 경로). */
  replaceOpen?: boolean;
}): Promise<EnsureRebalanceSuggestionResult> {
  const admin = getAgentAdmin();
  if (!admin) return { ok: false, error: "no-admin" };

  const ctx = await loadTripRebalanceCtx(args.tripId);
  if (!ctx) return { ok: false, error: "trip-not-found" };

  const preview = toPreview(ctx);
  if (!preview.shouldSuggest) {
    return { ok: false, error: "within-budget", preview };
  }

  if (ctx.openSuggestionId && !args.replaceOpen) {
    return {
      ok: true,
      suggestionId: ctx.openSuggestionId,
      created: false,
      preview,
    };
  }

  if (ctx.openSuggestionId && args.replaceOpen) {
    const { error: dismissErr } = await admin.rpc(
      "agent_dismiss_suggestion",
      {
        p_actor: args.actorUserId,
        p_suggestion_id: ctx.openSuggestionId,
      }
    );
    if (dismissErr) {
      console.error(
        "[ensureOpenRebalanceSuggestion] dismiss",
        dismissErr.message
      );
      return { ok: false, error: "rpc-failed", preview };
    }
  }

  const { proposal, planVersion } = ctx;
  try {
    const { data: suggestionId, error } = await admin.rpc(
      "agent_create_suggestion",
      {
        p_actor: args.actorUserId,
        p_trip_id: args.tripId,
        p_type: "rebalance",
        p_payload: {
          message: proposal.message,
          adjustmentsLog: proposal.adjustmentsLog,
          overCategories: proposal.overCategories,
          threshold: proposal.threshold,
          variances: proposal.variances,
          adjustedItems: proposal.adjustedItems,
          remainingBudgetKrw: proposal.remainingBudgetKrw,
          remainingScheduleEstKrw: proposal.remainingScheduleEstKrw,
          gapKrw: proposal.gapKrw,
          dropped: proposal.dropped,
          source: proposal.source,
          planVersion,
        },
      }
    );
    if (error || !suggestionId) {
      console.error("[ensureOpenRebalanceSuggestion]", error?.message);
      return { ok: false, error: "rpc-failed", preview };
    }
    return {
      ok: true,
      suggestionId: String(suggestionId),
      created: true,
      preview,
    };
  } catch (err) {
    console.error("[ensureOpenRebalanceSuggestion]", err);
    return { ok: false, error: "rpc-threw", preview };
  }
}
