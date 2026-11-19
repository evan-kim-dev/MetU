import {
  FIXED_BUDGET_CATEGORIES,
  VARIABLE_BUDGET_CATEGORIES,
  type BudgetCategoryId,
  type BudgetPlan,
  type ConfirmedExpenseView,
} from "@/lib/budget/types";

function truncNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function normalizeCategory(raw: string): BudgetCategoryId | null {
  const t = raw.trim().toLowerCase();
  if (t === "flight" || t === "항공" || t === "항공권") return "flight";
  if (t === "stay" || t === "hotel" || t === "숙소") return "stay";
  if (t === "food" || t === "식비") return "food";
  if (t === "transport" || t === "교통") return "transport";
  if (
    t === "etc" ||
    t === "activity" ||
    t === "관광" ||
    t === "쇼핑" ||
    t === "기타"
  ) {
    return "etc";
  }
  return null;
}

export type DailyAllowanceResult = {
  /** 오늘 쓸 수 있는 돈 (변동 잔여 / 남은 일수) */
  allowanceKrw: number;
  remainingVariableKrw: number;
  remainingDays: number;
  spentVariableKrw: number;
  variableBudgetKrw: number;
};

function variableBudget(plan: BudgetPlan): number {
  return VARIABLE_BUDGET_CATEGORIES.reduce(
    (s, id) => s + truncNonNeg(plan.categories[id]?.limit ?? 0),
    0
  );
}

function sumVariableSpent(
  expenses: ReadonlyArray<ConfirmedExpenseView>
): number {
  let sum = 0;
  for (const e of expenses) {
    const cat = normalizeCategory(String(e.category));
    if (!cat) {
      // 미분류는 변동으로 본다
      sum += truncNonNeg(e.krwAmount);
      continue;
    }
    if ((FIXED_BUDGET_CATEGORIES as readonly string[]).includes(cat)) continue;
    sum += truncNonNeg(e.krwAmount);
  }
  return sum;
}

/**
 * 오늘 쓸 수 있는 돈 = (남은 변동 예산) / (남은 일수).
 * 고정비(flight/stay) 지출은 분자에서 제외한다.
 */
export function dailyAllowance(args: {
  plan: BudgetPlan;
  confirmedExpenses: ReadonlyArray<ConfirmedExpenseView>;
  /** YYYY-MM-DD */
  today: string;
  /** 여행 종료일 YYYY-MM-DD (포함) */
  endDate: string;
  /** 여행 시작일 YYYY-MM-DD (포함). 없으면 today 기준 */
  startDate?: string;
}): DailyAllowanceResult {
  const variableBudgetKrw = variableBudget(args.plan);
  const spentVariableKrw = sumVariableSpent(args.confirmedExpenses);
  const remainingVariableKrw = variableBudgetKrw - spentVariableKrw;

  const remainingDays = remainingInclusiveDays(args.today, args.endDate);
  const allowanceKrw =
    remainingDays > 0
      ? Math.floor(remainingVariableKrw / remainingDays)
      : remainingVariableKrw;

  return {
    allowanceKrw,
    remainingVariableKrw,
    remainingDays,
    spentVariableKrw,
    variableBudgetKrw,
  };
}

/** today~endDate 포함 일수. end < today 이면 0. */
export function remainingInclusiveDays(today: string, endDate: string): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  if (b < a) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

export { normalizeCategory as normalizeBudgetCategory };
