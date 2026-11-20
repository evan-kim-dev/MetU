"use client";

import { useState } from "react";
import { ChartColumn, Scale } from "lucide-react";
import { Button } from "@/components/ds/Button";
import type { OpenBudgetSuggestion } from "@/lib/ledger/open-suggestions";

type Props = {
  tripId: string;
  suggestion: OpenBudgetSuggestion;
  onSettled: () => void;
  /** settle 이면 정산 단계로 이동 (수락은 정산에서) */
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

  const isRebalance = suggestion.type === "rebalance";
  const Icon = isRebalance ? ChartColumn : Scale;
  const title = isRebalance ? "예산 재조정 제안" : "정산 제안";
  const previewLines = suggestion.adjustmentsLog.slice(0, 3);
  const moreLog = Math.max(0, suggestion.adjustmentsLog.length - previewLines.length);

  async function decide(decision: "accepted" | "dismissed") {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      if (decision === "accepted" && !isRebalance && onGoSettle) {
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
    <section
      aria-label={title}
      className="overflow-hidden rounded-mu-xl border border-mu-line bg-mu-card"
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        <span
          className={
            isRebalance
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mu-warn-soft text-mu-warn"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mu-accent-soft text-mu-accent"
          }
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-mu-label font-bold text-mu-fg">{title}</p>
          <p className="mt-0.5 text-mu-body text-mu-fg-2">{suggestion.message}</p>
          {suggestion.overLabels.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="초과 카테고리">
              {suggestion.overLabels.map((label) => (
                <li
                  key={label}
                  className="rounded-mu-sm bg-mu-warn-soft px-2 py-1 text-mu-caption font-semibold text-mu-warn"
                >
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
          {!isRebalance && suggestion.transferCount > 0 ? (
            <p className="mt-2 text-mu-caption text-mu-fg-3">
              송금{" "}
              <span className="mu-num font-semibold text-mu-fg-2">
                {suggestion.transferCount}
              </span>
              건으로 맞출 수 있어요
            </p>
          ) : null}
          {previewLines.length > 0 ? (
            <ul className="mt-2 space-y-1 rounded-mu-md bg-mu-sunken px-3 py-2">
              {previewLines.map((line, i) => (
                <li
                  key={`adj-${i}`}
                  className="truncate text-mu-caption text-mu-fg-2"
                >
                  {line}
                </li>
              ))}
              {moreLog > 0 ? (
                <li className="text-mu-caption text-mu-fg-3">
                  외 {moreLog}건 더
                </li>
              ) : null}
            </ul>
          ) : null}
          {err ? (
            <p role="alert" className="mt-2 text-mu-caption text-mu-err">
              {err}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2 border-t border-mu-line px-4 py-3">
        <Button
          className="flex-1"
          loading={busy}
          disabled={busy}
          onClick={() => void decide("accepted")}
        >
          {isRebalance ? "일정에 반영하기" : "정산에서 확인하기"}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={() => void decide("dismissed")}
        >
          나중에
        </Button>
      </div>
    </section>
  );
}
