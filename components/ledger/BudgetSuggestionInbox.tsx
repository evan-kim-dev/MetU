"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { OpenBudgetSuggestionCard } from "@/components/ledger/OpenBudgetSuggestionCard";
import {
  fetchOpenBudgetSuggestions,
  type OpenBudgetSuggestion,
} from "@/lib/ledger/open-suggestions";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = {
  tripId: string;
  /** settle 카드 → 정산 딥링크 */
  settleHref?: string;
};

/**
 * 확인함 상단: open rebalance·settle Suggestion.
 * record 는 AgentInbox(needs_review) 경로.
 */
export function BudgetSuggestionInbox({ tripId, settleHref }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<OpenBudgetSuggestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoaded(true);
      return;
    }
    const next = await fetchOpenBudgetSuggestions(supabase, tripId);
    setRows(next);
    setLoaded(true);
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!loaded || rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-mu-caption font-semibold text-mu-fg-2">예산·정산 제안</p>
      {rows.map((s) => (
        <OpenBudgetSuggestionCard
          key={s.id}
          tripId={tripId}
          suggestion={s}
          onSettled={() => void reload()}
          onGoSettle={
            s.type === "settle" && settleHref
              ? () => {
                  router.push(settleHref);
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}
