import { TABLES } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OpenBudgetSuggestion = {
  id: string;
  type: "rebalance" | "settle";
  message: string;
  createdAt: string;
};

type CountClient = Pick<SupabaseClient, "from">;

/**
 * Today/정산에 보여줄 open rebalance·settle Suggestion.
 * record 는 확인함(agent_events) 경로를 쓴다.
 */
export async function fetchOpenBudgetSuggestions(
  supabase: CountClient,
  tripId: string
): Promise<OpenBudgetSuggestion[]> {
  const { data, error } = await supabase
    .from(TABLES.tripSuggestions)
    .select("id, type, payload, created_at")
    .eq("trip_id", tripId)
    .eq("status", "open")
    .in("type", ["rebalance", "settle"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[fetchOpenBudgetSuggestions]", error.message);
    return [];
  }

  const out: OpenBudgetSuggestion[] = [];
  for (const row of data ?? []) {
    const type = row.type === "rebalance" || row.type === "settle" ? row.type : null;
    if (!type) continue;
    const payload =
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {};
    const message =
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : type === "rebalance"
          ? "예산을 넘는 지출이 있어요. 남은 일정 조정을 확인해 주세요."
          : "정산 제안이 준비됐어요. 확인 후 반영해 주세요.";
    out.push({
      id: String(row.id),
      type,
      message,
      createdAt: String(row.created_at ?? ""),
    });
  }
  return out;
}
