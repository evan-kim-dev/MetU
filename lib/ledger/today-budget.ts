/**
 * 가계부 Today 히어로용 표시 계산 (순수 함수).
 * LLM/클라이언트가 금액을 "확정"하지 않고, 일 예산·오늘 소진·잔여만 보여요.
 */

export type TodayBudgetView = {
  dayBudgetKrw: number;
  spentTodayKrw: number;
  remainingKrw: number;
  usedRatio: number;
};

function truncNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

/** 총예산 ÷ 여행일수 (일수 없으면 1). */
export function dayBudgetFromTrip(args: {
  totalBudgetKrw: number;
  tripDays: number;
}): number {
  const days = Math.max(1, Math.trunc(args.tripDays) || 1);
  return Math.floor(truncNonNeg(args.totalBudgetKrw) / days);
}

export function sumSpentOnDate(
  expenses: ReadonlyArray<{ spentOn?: string; krwAmount: number }>,
  isoDate: string
): number {
  return expenses.reduce((s, e) => {
    if (e.spentOn !== isoDate) return s;
    return s + truncNonNeg(e.krwAmount);
  }, 0);
}

export function deriveTodayBudget(args: {
  totalBudgetKrw: number;
  tripDays: number;
  expenses: ReadonlyArray<{ spentOn?: string; krwAmount: number }>;
  todayIso: string;
}): TodayBudgetView {
  const dayBudgetKrw = dayBudgetFromTrip({
    totalBudgetKrw: args.totalBudgetKrw,
    tripDays: args.tripDays,
  });
  const spentTodayKrw = sumSpentOnDate(args.expenses, args.todayIso);
  const remainingKrw = dayBudgetKrw - spentTodayKrw;
  const usedRatio =
    dayBudgetKrw > 0
      ? Math.min(1, Math.max(0, spentTodayKrw / dayBudgetKrw))
      : spentTodayKrw > 0
        ? 1
        : 0;
  return { dayBudgetKrw, spentTodayKrw, remainingKrw, usedRatio };
}

/** start/end(YYYY-MM-DD) 포함 일수. 없으면 nights+1 또는 1. */
export function tripDayCount(args: {
  startDate?: string | null;
  endDate?: string | null;
  nights?: number | null;
  scheduleDays?: number | null;
}): number {
  if (args.startDate && args.endDate) {
    const a = Date.parse(`${args.startDate}T00:00:00Z`);
    const b = Date.parse(`${args.endDate}T00:00:00Z`);
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      return Math.floor((b - a) / 86_400_000) + 1;
    }
  }
  if (args.scheduleDays && args.scheduleDays > 0) {
    return Math.trunc(args.scheduleDays);
  }
  if (args.nights != null && args.nights >= 0) {
    return Math.trunc(args.nights) + 1;
  }
  return 1;
}
