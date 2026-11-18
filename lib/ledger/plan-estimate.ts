import type { Trip } from "@/lib/trips/types";

/**
 * 플랜 예상 지출 (일정 dayTotal 합 우선, 없으면 예산 배분 합).
 * 실제 가계부 합과 섞지 않는다.
 */
export function planEstimateKrw(
  trip: Pick<Trip, "dailySchedule" | "budgetAllocation">
): number | null {
  const days = trip.dailySchedule ?? [];
  if (days.length > 0) {
    const sum = days.reduce(
      (s, d) => s + (Number.isFinite(d.dayTotal) ? Math.trunc(d.dayTotal) : 0),
      0
    );
    return sum > 0 ? sum : null;
  }
  const alloc = trip.budgetAllocation ?? [];
  if (alloc.length === 0) return null;
  const sum = alloc.reduce(
    (s, a) => s + (Number.isFinite(a.amount) ? Math.trunc(a.amount) : 0),
    0
  );
  return sum > 0 ? sum : null;
}

export type BudgetView = {
  limitKrw: number;
  actualKrw: number;
  planKrw: number | null;
  remainingLimitKrw: number;
  overLimit: boolean;
  overPlan: boolean;
};

export function deriveBudgetView(args: {
  budget: number;
  spent: number;
  planKrw: number | null;
}): BudgetView {
  const limitKrw = Math.max(0, Math.trunc(args.budget));
  const actualKrw = Math.max(0, Math.trunc(args.spent));
  const planKrw = args.planKrw;
  return {
    limitKrw,
    actualKrw,
    planKrw,
    remainingLimitKrw: limitKrw - actualKrw,
    overLimit: actualKrw > limitKrw && limitKrw > 0,
    overPlan: planKrw != null && actualKrw > planKrw,
  };
}

/** 초과 시 UI 문구 — 암묵 일정 변경 금지, 확인함과 같은 언어. */
export function budgetOverageCopy(view: BudgetView): string | null {
  if (view.overLimit) {
    return "예산 한도를 넘었어요. 일정을 줄일지 확인이 필요해요.";
  }
  if (view.overPlan) {
    return "플랜 예상보다 실제 지출이 커요. 일정을 조정할지 확인이 필요해요.";
  }
  return null;
}
