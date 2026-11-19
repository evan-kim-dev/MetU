import { TABLES } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

/** LedgerShell / TripJourney / AgentHub 와 같은 대기 이벤트 상태. */
export const PENDING_EVENT_STATUSES = [
  "received",
  "processing",
  "needs_review",
  "failed",
] as const;

export function sumInboxCounts(
  eventCount: number | null | undefined,
  proposalCount: number | null | undefined = 0,
  suggestionCount: number | null | undefined = 0
): number {
  return (
    Math.max(0, eventCount ?? 0) +
    Math.max(0, proposalCount ?? 0) +
    Math.max(0, suggestionCount ?? 0)
  );
}

type CountClient = Pick<SupabaseClient, "from">;

/**
 * 여행 스코프 확인함 건수 = 대기 agent_events + (선택) pending proposals.
 * 배너·쉘·여정이 같은 식을 쓴다.
 */
export async function fetchTripInboxCount(
  supabase: CountClient,
  args: {
    tripId: string;
    userId: string;
    includeProposals?: boolean;
  }
): Promise<number> {
  const pendingRes = await supabase
    .from("agent_events")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", args.tripId)
    .eq("user_id", args.userId)
    .in("status", [...PENDING_EVENT_STATUSES]);

  let proposalCount = 0;
  let suggestionCount = 0;
  if (args.includeProposals) {
    const [proposalRes, botRes, suggestionRes] = await Promise.all([
      supabase
        .from(TABLES.tripExpenseProposals)
        .select("id", { count: "exact", head: true })
        .eq("trip_id", args.tripId)
        .eq("status", "pending"),
      supabase
        .from(TABLES.tripBotProposals)
        .select("id", { count: "exact", head: true })
        .eq("trip_id", args.tripId)
        .eq("status", "pending"),
      supabase
        .from(TABLES.tripSuggestions)
        .select("id", { count: "exact", head: true })
        .eq("trip_id", args.tripId)
        .eq("status", "open")
        .in("type", ["rebalance", "settle"]),
    ]);
    proposalCount = (proposalRes.count ?? 0) + (botRes.count ?? 0);
    suggestionCount = suggestionRes.count ?? 0;
  }

  return sumInboxCounts(pendingRes.count, proposalCount, suggestionCount);
}

/** 전역 확인함 — 미배정(unassigned)만. */
export async function fetchUnassignedInboxCount(
  supabase: CountClient,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from("agent_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "unassigned");
  return sumInboxCounts(count, 0);
}
