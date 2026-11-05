"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DaySchedule } from "@/lib/ai/types";
import {
  rebalanceScheduleBudget,
  type RebalanceResult,
} from "@/lib/budget/rebalancer";
import {
  applyRebalanceCostsToSchedule,
  previewDiscretionaryGap,
  scheduleToRebalanceItems,
} from "@/lib/budget/schedule-map";
import { formatKRW } from "@/lib/shared/format";

export type BudgetRebalanceBarProps = {
  /** 현재 총예산 (슬라이더 초기값) */
  totalBudget: number;
  /** 항공+숙소 고정비 — 목표 총예산에서 빼서 현지 가용으로 씀 */
  fixedCostKRW: number;
  dailySchedule: DaySchedule[];
  /** 슬라이더 하한 (기본 80만) */
  minBudget?: number;
  /** 슬라이더 상한 (기본 150만) */
  maxBudget?: number;
  onRebalanced: (payload: {
    targetBudget: number;
    schedule: DaySchedule[];
    result: RebalanceResult;
  }) => void;
};

function summarizeLog(result: RebalanceResult): string {
  if (result.savedAmount <= 0) {
    return result.adjustmentsLog[0] ?? "조정할 항목이 없어요.";
  }
  const count = result.adjustmentsLog.filter((l) => l.includes("-₩")).length;
  const sample = result.adjustmentsLog[0]?.split(":")[0]?.trim() ?? "일정";
  return `${sample} 등 ${count}건을 가성비 스팟으로 재조정하여 총 ${formatKRW(result.savedAmount)}을 절감했어요.`;
}

export function BudgetRebalanceBar({
  totalBudget,
  fixedCostKRW,
  dailySchedule,
  minBudget = 800_000,
  maxBudget = 1_500_000,
  onRebalanced,
}: BudgetRebalanceBarProps) {
  const lo = Math.min(minBudget, maxBudget);
  const hi = Math.max(minBudget, maxBudget);
  const clampedBudget = Math.min(hi, Math.max(lo, totalBudget));
  const [target, setTarget] = useState(clampedBudget);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    setTarget(Math.min(hi, Math.max(lo, totalBudget)));
  }, [totalBudget, lo, hi]);

  const discretionaryTarget = useMemo(
    () => Math.max(0, target - Math.max(0, fixedCostKRW)),
    [target, fixedCostKRW]
  );

  const preview = useMemo(
    () =>
      previewDiscretionaryGap({
        schedule: dailySchedule,
        targetDiscretionaryBudget: discretionaryTarget,
      }),
    [dailySchedule, discretionaryTarget]
  );

  function handleRebalance() {
    if (busy) return;
    setBusy(true);
    try {
      const items = scheduleToRebalanceItems(dailySchedule);
      const result = rebalanceScheduleBudget(items, discretionaryTarget);
      const schedule = applyRebalanceCostsToSchedule(
        dailySchedule,
        result.adjustedItems
      );
      onRebalanced({ targetBudget: target, schedule, result });
      setBanner(summarizeLog(result));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-mu-body font-bold text-mu-fg">예산 상한 조정</p>
        <p className="mu-num text-mu-body font-extrabold text-mu-accent">
          {formatKRW(target)}
        </p>
      </div>
      <label className="flex flex-col gap-2">
        <span className="sr-only">총예산 슬라이더</span>
        <input
          type="range"
          min={lo}
          max={hi}
          step={10_000}
          value={target}
          onChange={(e) => {
            setTarget(Number(e.target.value));
            setBanner(null);
          }}
          className="h-11 w-full accent-[var(--mu-accent)]"
        />
        <span className="flex justify-between text-mu-caption font-semibold text-mu-fg-3">
          <span>{formatKRW(lo)}</span>
          <span>현지 가용 {formatKRW(discretionaryTarget)}</span>
          <span>{formatKRW(hi)}</span>
        </span>
      </label>
      {preview.gap > 0 ? (
        <p className="text-mu-caption font-semibold text-mu-warn">
          지금 일정은 현지 가용보다 {formatKRW(preview.gap)} 많아요. 리밸런싱하면
          맞춰 드려요.
        </p>
      ) : preview.gap < 0 ? (
        <p className="text-mu-caption font-semibold text-mu-ok">
          현지 가용보다 {formatKRW(-preview.gap)} 여유가 있어요.
        </p>
      ) : (
        <p className="text-mu-caption font-semibold text-mu-fg-3">
          일정 합과 현지 가용이 같아요.
        </p>
      )}
      <button
        type="button"
        disabled={busy || dailySchedule.length === 0}
        onClick={handleRebalance}
        className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-mu-xl bg-mu-accent px-4 text-mu-body font-bold text-mu-on-accent disabled:opacity-50"
      >
        {busy ? (
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden />
        )}
        이 예산에 맞춰 일정 리밸런싱
      </button>
      {banner ? (
        <p
          role="status"
          className="rounded-mu-md border border-mu-accent/20 bg-mu-accent-soft px-3 py-2.5 text-mu-caption leading-relaxed text-mu-fg-2"
        >
          {banner}
        </p>
      ) : null}
    </div>
  );
}
