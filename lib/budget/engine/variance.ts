import { normalizeBudgetCategory } from "@/lib/budget/engine/dailyAllowance";
import {
  type BudgetCategoryId,
  type BudgetPlan,
  type CategoryVariance,
  type ConfirmedExpenseView,
} from "@/lib/budget/types";

const ORDER: BudgetCategoryId[] = [
  "flight",
  "stay",
  "food",
  "transport",
  "etc",
];

function truncNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

/**
 * 카테고리별 계획 한도 대비 확정 지출과 초과율.
 * overRatio = actual / planLimit (한도 0이고 actual>0 이면 null → 호출측에서 초과로 취급).
 */
export function variance(
  plan: BudgetPlan,
  expenses: ReadonlyArray<ConfirmedExpenseView>
): CategoryVariance[] {
  const actuals: Record<BudgetCategoryId, number> = {
    flight: 0,
    stay: 0,
    food: 0,
    transport: 0,
    etc: 0,
  };

  for (const e of expenses) {
    const cat = normalizeBudgetCategory(String(e.category)) ?? "etc";
    actuals[cat] += truncNonNeg(e.krwAmount);
  }

  return ORDER.map((category) => {
    const planLimit = truncNonNeg(plan.categories[category]?.limit ?? 0);
    const actual = actuals[category];
    const delta = actual - planLimit;
    let overRatio: number | null;
    if (planLimit <= 0) {
      overRatio = actual > 0 ? null : 0;
    } else {
      overRatio = actual / planLimit;
    }
    return { category, planLimit, actual, delta, overRatio };
  });
}

/** 어느 카테고리든 overRatio > threshold(기본 1.15 = +15%)이면 true. */
export function hasVarianceOver(
  rows: ReadonlyArray<CategoryVariance>,
  threshold = 1.15
): boolean {
  for (const r of rows) {
    if (r.overRatio == null && r.actual > 0) return true;
    if (r.overRatio != null && r.overRatio > threshold) return true;
  }
  return false;
}

export const REBALANCE_OVER_RATIO = 1.15;
