import type { BudgetInsightRecord } from "@/lib/ai/budget-insight-record";
import { TABLES } from "@/lib/constants";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function persistBudgetInsightLog(
  record: BudgetInsightRecord,
  userId?: string | null
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  const { error } = await supabase.from(TABLES.budgetInsightLogs).insert({
    user_id: userId ?? null,
    budget: record.budget,
    month: record.month,
    source: record.source,
    insight: record.insight,
    local_fallback: record.localFallback,
    rag_band_id: record.rag.bandId,
    allowed_regions: record.rag.allowedRegions,
    rag_contexts: record.rag.contexts,
    season_tip: record.rag.seasonTip,
  });

  if (error) {
    console.error("[budget-insight] persist failed:", error.message);
  }
}
