/**
 * RebalanceAgent (순수): variance > 15% 이면 남은 PlanItem 감축안만 만든다.
 * PlanItem / BudgetPlan 은 직접 패치하지 않는다 — Suggestion payload 전용.
 */
import {
  hasVarianceOver,
  REBALANCE_OVER_RATIO,
  variance,
} from "@/lib/budget/engine/variance";
import { BUDGET_CATEGORY_LABELS } from "@/lib/budget/types";
import type {
  BudgetCategoryId,
  BudgetPlan,
  CategoryVariance,
  ConfirmedExpenseView,
  PlanItem,
} from "@/lib/budget/types";

export type RebalanceProposal = {
  shouldSuggest: boolean;
  threshold: number;
  variances: CategoryVariance[];
  overCategories: BudgetCategoryId[];
  /** 수락 시 적용할 남은 일정 초안 (원본과 동일 day/time/title) */
  adjustedItems: PlanItem[];
  message: string;
  adjustmentsLog: string[];
};

function truncNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function fmtWon(n: number): string {
  return `${truncNonNeg(n).toLocaleString("ko-KR")}원`;
}

/**
 * 초과 카테고리의 남은 일정 추정비를 (한도 − 확정 지출)에 맞춰 비례 감축.
 * 고정비(flight/stay)는 건드리지 않는다.
 */
export function cutRemainingPlanItems(args: {
  variances: ReadonlyArray<CategoryVariance>;
  remainingItems: ReadonlyArray<PlanItem>;
}): { items: PlanItem[]; log: string[] } {
  const remainingByCat: Partial<Record<BudgetCategoryId, number>> = {};
  for (const v of args.variances) {
    remainingByCat[v.category] = Math.max(0, v.planLimit - v.actual);
  }

  const log: string[] = [];
  const items = args.remainingItems.map((item) => ({ ...item }));

  const byCat = new Map<BudgetCategoryId, number[]>();
  items.forEach((item, idx) => {
    if (item.category === "flight" || item.category === "stay") return;
    const list = byCat.get(item.category) ?? [];
    list.push(idx);
    byCat.set(item.category, list);
  });

  for (const [category, idxs] of byCat) {
    const cap = remainingByCat[category];
    if (cap == null) continue;
    const sum = idxs.reduce((s, i) => s + truncNonNeg(items[i]!.estCost), 0);
    if (sum <= cap || sum <= 0) continue;

    let allocated = 0;
    idxs.forEach((i, j) => {
      const cur = truncNonNeg(items[i]!.estCost);
      const isLast = j === idxs.length - 1;
      const next = isLast
        ? Math.max(0, cap - allocated)
        : Math.floor((cur * cap) / sum);
      allocated += isLast ? 0 : next;
      if (next !== cur) {
        const row = items[i]!;
        // 같은 제목 일정이 여러 개여도 로그·리스트 key 가 겹치지 않게 day/time 을 넣어요.
        log.push(
          `Day${row.day} ${row.time} ${row.title}: ${fmtWon(cur)} → ${fmtWon(next)} (${BUDGET_CATEGORY_LABELS[category]})`
        );
        items[i] = { ...row, estCost: next };
      }
    });
  }

  return { items, log };
}

/**
 * confirmed 지출 기준 variance 검사 → rebalance Suggestion 초안.
 * shouldSuggest=false 이면 adjustedItems 는 원본 복사.
 */
export function buildRebalanceProposal(args: {
  plan: BudgetPlan;
  expenses: ReadonlyArray<ConfirmedExpenseView>;
  remainingItems: ReadonlyArray<PlanItem>;
  threshold?: number;
}): RebalanceProposal {
  const threshold = args.threshold ?? REBALANCE_OVER_RATIO;
  const variances = variance(args.plan, args.expenses);
  const over = hasVarianceOver(variances, threshold);
  const overCategories = variances
    .filter((v) => {
      if (v.overRatio == null && v.actual > 0) return true;
      return v.overRatio != null && v.overRatio > threshold;
    })
    .map((v) => v.category);

  if (!over) {
    return {
      shouldSuggest: false,
      threshold,
      variances,
      overCategories: [],
      adjustedItems: args.remainingItems.map((i) => ({ ...i })),
      message: "예산 한도 안이에요.",
      adjustmentsLog: [],
    };
  }

  const { items, log } = cutRemainingPlanItems({
    variances,
    remainingItems: args.remainingItems,
  });

  const labels = overCategories
    .map((c) => BUDGET_CATEGORY_LABELS[c])
    .join(", ");
  const pct = Math.round((threshold - 1) * 100);

  return {
    shouldSuggest: true,
    threshold,
    variances,
    overCategories,
    adjustedItems: items,
    message:
      log.length > 0
        ? `${labels}가 한도보다 ${pct}% 넘게 썼어요. 남은 일정 예산을 줄이는 안을 확인해요.`
        : `${labels}가 한도보다 ${pct}% 넘게 썼어요. 남은 일정은 이미 맞춰져 있어요.`,
    adjustmentsLog: log,
  };
}
