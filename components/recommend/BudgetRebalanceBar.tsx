"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { DaySchedule } from "@/lib/ai/types";
import {
  classifyRebalanceCategory,
  rebalanceScheduleBudget,
  type RebalanceItem,
  type RebalanceResult,
} from "@/lib/budget/rebalancer";
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

function scheduleToItems(schedule: DaySchedule[]): RebalanceItem[] {
  const items: RebalanceItem[] = [];
  for (const day of schedule) {
    for (let i = 0; i < day.items.length; i += 1) {
      const item = day.items[i]!;
      items.push({
        id: `d${day.day}-${i}-${item.title}`,
        name: `Day ${day.day} ${item.title}`,
        category: classifyRebalanceCategory(item.kind, item.title),
        costKRW: Math.max(0, Math.floor(item.cost)),
        isFixed: item.kind === "attraction" || item.kind === "lodging",
      });
    }
  }
  return items;
}

function applyCostsToSchedule(
  schedule: DaySchedule[],
  adjusted: RebalanceItem[]
): DaySchedule[] {
  const costById = new Map(adjusted.map((a) => [a.id, a.costKRW]));
  return schedule.map((day) => {
    const items = day.items.map((item, i) => {
      const id = `d${day.day}-${i}-${item.title}`;
      const next = costById.get(id);
      return next == null ? item : { ...item, cost: next };
    });
    return {
      ...day,
      items,
      dayTotal: items.reduce((s, it) => s + it.cost, 0),
    };
  });
}

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
  const initial = Math.min(hi, Math.max(lo, totalBudget));
  const [target, setTarget] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const discretionaryTarget = useMemo(
    () => Math.max(0, target - Math.max(0, fixedCostKRW)),
    [target, fixedCostKRW]
  );

  function handleRebalance() {
    if (busy) return;
    setBusy(true);
    try {
      const items = scheduleToItems(dailySchedule);
      const result = rebalanceScheduleBudget(items, discretionaryTarget);
      const schedule = applyCostsToSchedule(dailySchedule, result.adjustedItems);
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
