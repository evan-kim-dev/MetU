import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import { buildRebalanceProposal } from "@/lib/agent/rebalance-agent";
import {
  budgetPlanFromAllocation,
  planItemsFromDailySchedule,
} from "@/lib/budget/adapters";
import { TABLES } from "@/lib/constants";
import { notifyUsers } from "@/lib/agent/notify";

export type RebalanceRunResult = {
  suggested: boolean;
  suggestionId?: string | null;
  reason?: string;
};

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

/**
 * confirmed 지출 반영 후 variance 검사 → open rebalance Suggestion 1건.
 * 일정 JSON 은 수락 전까지 바꾸지 않는다.
 */
export async function maybeSuggestRebalance(args: {
  tripId: string;
  actorUserId: string;
}): Promise<RebalanceRunResult> {
  const admin = getAgentAdmin();
  if (!admin) {
    return { suggested: false, reason: "no-admin" };
  }

  const { data: openExisting } = await admin
    .from(TABLES.tripSuggestions)
    .select("id")
    .eq("trip_id", args.tripId)
    .eq("type", "rebalance")
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (openExisting?.id) {
    return {
      suggested: false,
      reason: "open-exists",
      suggestionId: String(openExisting.id),
    };
  }

  const { data: trip } = await admin
    .from(TABLES.trips)
    .select("id, people, budget, budget_allocation, daily_schedule")
    .eq("id", args.tripId)
    .maybeSingle();

  if (!trip) {
    return { suggested: false, reason: "trip-not-found" };
  }

  const allocation = Array.isArray(trip.budget_allocation)
    ? (trip.budget_allocation as AllocRow[])
    : [];
  const total =
    typeof trip.budget === "number" && Number.isFinite(trip.budget)
      ? Math.trunc(trip.budget)
      : allocation.reduce((s, a) => s + Math.max(0, Math.trunc(a.amount) || 0), 0);

  const plan = budgetPlanFromAllocation({
    tripId: args.tripId,
    total,
    people: typeof trip.people === "number" ? trip.people : 1,
    allocation,
  });

  const schedule = Array.isArray(trip.daily_schedule)
    ? (trip.daily_schedule as DayRow[])
    : [];
  const remainingItems = planItemsFromDailySchedule({
    tripId: args.tripId,
    dailySchedule: schedule,
  });

  const { data: expenseRows } = await admin
    .from(TABLES.tripExpenses)
    .select("category, krw_amount, spent_on, status")
    .eq("trip_id", args.tripId)
    .in("status", ["confirmed", "auto"]);

  const expenses = (expenseRows ?? []).map((e) => ({
    category: String(e.category ?? "etc"),
    krwAmount: Math.max(0, Math.trunc(Number(e.krw_amount) || 0)),
    occurredOn:
      typeof e.spent_on === "string" ? e.spent_on : null,
  }));

  const proposal = buildRebalanceProposal({
    plan,
    expenses,
    remainingItems,
  });

  if (!proposal.shouldSuggest) {
    return { suggested: false, reason: "within-budget" };
  }

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
          planVersion: plan.version,
        },
      }
    );
    if (error) {
      console.error("[maybeSuggestRebalance]", error.message);
      return { suggested: false, reason: "rpc-failed" };
    }

    await notifyUsers({
      userIds: [args.actorUserId],
      type: "expense_review",
      tripId: args.tripId,
      actorId: args.actorUserId,
      payload: {
        suggestionType: "rebalance",
        message: proposal.message,
      },
      dedupeKey: `rebalance_suggest:${args.tripId}:${plan.version}`,
    });

    return {
      suggested: true,
      suggestionId: suggestionId ? String(suggestionId) : null,
    };
  } catch (err) {
    console.error("[maybeSuggestRebalance]", err);
    return { suggested: false, reason: "rpc-threw" };
  }
}
