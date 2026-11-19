/**
 * PlanAgent: allocate 한도 안에서 일정(PlanItem/DaySchedule)을 만든다.
 * 금액 한도는 순수 함수, LLM은 해석·일정 후보만 (호출은 generate-plan / enrich).
 */
import { allocate } from "@/lib/budget/engine/allocate";
import {
  VARIABLE_BUDGET_CATEGORIES,
  type BudgetCategoryId,
  type BudgetPlan,
} from "@/lib/budget/types";
import { parseBudgetAmount } from "@/lib/ai/budget-insight";
import type { OnboardingForm } from "@/lib/onboarding/types";
import type { BudgetAllocation, DaySchedule } from "@/lib/ai/types";

const LEGACY_COLOR: Record<BudgetCategoryId, string> = {
  flight: "#2563EB",
  stay: "#7C3AED",
  food: "#F59E0B",
  transport: "#10B981",
  etc: "#EC4899",
};

function getNights(form: OnboardingForm): number {
  if (form.dateType === "specific" && form.startDate && form.endDate) {
    const start = Date.parse(`${form.startDate}T00:00:00`);
    const end = Date.parse(`${form.endDate}T00:00:00`);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)));
    }
  }
  return 5;
}

/** 온보딩 폼 → BudgetPlan (엔진 allocate). */
export function buildBudgetPlanFromForm(form: OnboardingForm): BudgetPlan {
  const total = parseBudgetAmount(form.budget);
  const travelers = Math.max(1, form.people);
  const nights = getNights(form);
  return allocate({
    total,
    travelers,
    nights,
    destination: form.destination,
  });
}

/**
 * BudgetPlan → 레거시 TripRecommendation.budgetAllocation.
 * stay→hotel, etc→activity (기존 UI/저장 호환).
 */
export function budgetPlanToLegacyAllocation(
  plan: BudgetPlan
): BudgetAllocation[] {
  const map: Array<{ id: string; cat: BudgetCategoryId; label: string }> = [
    { id: "flight", cat: "flight", label: "항공권" },
    { id: "hotel", cat: "stay", label: "숙소" },
    { id: "food", cat: "food", label: "식비" },
    { id: "transport", cat: "transport", label: "교통" },
    { id: "activity", cat: "etc", label: "관광·액티비티" },
  ];
  return map.map(({ id, cat, label }) => {
    const amount = plan.categories[cat]?.limit ?? 0;
    const percent =
      plan.total > 0 ? Math.round((amount / plan.total) * 100) : 0;
    return {
      id,
      label,
      amount,
      percent,
      color: LEGACY_COLOR[cat],
    };
  });
}

function itemVariableCost(title: string, cost: number): number {
  // 항공·숙소 제목은 변동 합에서 제외 (flight/hotel은 allocation 고정)
  if (/항공|비행|호텔|숙소|체크인|체크아웃/i.test(title)) return 0;
  return Math.max(0, Math.trunc(cost) || 0);
}

export function sumVariableScheduleCost(
  schedule: ReadonlyArray<DaySchedule>
): number {
  let sum = 0;
  for (const day of schedule) {
    for (const item of day.items) {
      sum += itemVariableCost(item.title, item.cost);
    }
  }
  return sum;
}

export function variableLimitFromPlan(plan: BudgetPlan): number {
  return VARIABLE_BUDGET_CATEGORIES.reduce(
    (s, id) => s + (plan.categories[id]?.limit ?? 0),
    0
  );
}

/**
 * 일정 변동비 합이 한도를 넘으면 비례 축소.
 * LLM이 금액을 확정하지 못하게 서버에서 clamp.
 */
export function clampScheduleToBudgetPlan(
  schedule: DaySchedule[],
  plan: BudgetPlan
): { schedule: DaySchedule[]; clamped: boolean } {
  const limit = variableLimitFromPlan(plan);
  const sum = sumVariableScheduleCost(schedule);
  if (limit <= 0 || sum <= limit) {
    return { schedule, clamped: false };
  }
  const ratio = limit / sum;
  const next = schedule.map((day) => {
    const items = day.items.map((item) => {
      const variable = itemVariableCost(item.title, item.cost);
      if (variable <= 0) return item;
      return {
        ...item,
        cost: Math.max(0, Math.floor(item.cost * ratio)),
      };
    });
    const dayTotal = items.reduce((s, i) => s + (i.cost || 0), 0);
    return { ...day, items, dayTotal };
  });
  return { schedule: next, clamped: true };
}

export function scheduleExceedsBudgetPlan(
  schedule: ReadonlyArray<DaySchedule>,
  plan: BudgetPlan
): boolean {
  return sumVariableScheduleCost(schedule) > variableLimitFromPlan(plan);
}
