"use client";

import { useState } from "react";
import { ChartColumn, Scale, X } from "lucide-react";
import type { OpenBudgetSuggestion } from "@/lib/ledger/open-suggestions";

type Props = {
  tripId: string;
  suggestion: OpenBudgetSuggestion;
  onSettled: () => void;
  /** settle 이면 정산 단계로 */
  onGoSettle?: () => void;
};

/**
 * Today 에 붙는 rebalance/settle Suggestion 카드.
 * 수락은 서버 accept API (금액·일정 재검증).
 */
export function OpenBudgetSuggestionCard({
  tripId,
  suggestion,
  onSettled,
  onGoSettle,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const Icon = suggestion.type === "rebalance" ? ChartColumn : Scale;
  const title =
    suggestion.type === "rebalance" ? "예산 재조정 제안" : "정산 제안";

  async function decide(decision: "accepted" | "dismissed") {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      if (decision === "accepted" && suggestion.type === "settle" && onGoSettle) {
        onGoSettle();
        return;
      }
      const res = await fetch(
        `/api/trips/${tripId}/suggestions/${suggestion.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        }
      );
      if (!res.ok) {
        console.error("[OpenBudgetSuggestionCard]", await res.text());
        setErr(
          decision === "accepted"
            ? "반영에 실패했어요. 잠시 후 다시 해 주세요."
            : "닫기에 실패했어요."
        );
        return;
      }
      onSettled();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-mu-xl border border-mu-line bg-mu-card">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mu-accent-soft text-mu-accent">
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-mu-label font-bold text-mu-fg">{title}</p>
          <p className="mt-0.5 text-mu-body text-mu-fg-2">{suggestion.message}</p>
          {err ? (
            <p role="alert" className="mt-2 text-mu-caption text-mu-err">
              {err}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="제안 닫기"
          disabled={busy}
          onClick={() => void decide("dismissed")}
          className="mu-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-mu-md text-mu-fg-3"
        >
          <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex gap-2 border-t border-mu-line px-4 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("accepted")}
          className="mu-focus flex min-h-tap flex-1 items-center justify-center rounded-mu-md bg-mu-accent text-mu-label font-semibold text-mu-on-accent disabled:opacity-60"
        >
          {suggestion.type === "settle" ? "정산에서 확인" : "반영하기"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide("dismissed")}
          className="mu-focus flex min-h-tap flex-1 items-center justify-center rounded-mu-md border border-mu-line text-mu-label font-semibold text-mu-fg disabled:opacity-60"
        >
          나중에
        </button>
      </div>
    </section>
  );
}
