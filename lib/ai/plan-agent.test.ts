import { describe, expect, it } from "vitest";
import { INITIAL_FORM } from "@/lib/onboarding/types";
import {
  budgetPlanToLegacyAllocation,
  buildBudgetPlanFromForm,
  clampScheduleToBudgetPlan,
  scheduleExceedsBudgetPlan,
  sumVariableScheduleCost,
  variableLimitFromPlan,
} from "./plan-agent";
import type { DaySchedule } from "./types";

describe("plan-agent", () => {
  it("폼에서 BudgetPlan 을 만들고 레거시 allocation 합이 total 이에요", () => {
    const form = {
      ...INITIAL_FORM,
      budget: "1,000,000",
      people: 2,
      destination: "오사카",
      dateType: "specific" as const,
      startDate: "2026-07-01",
      endDate: "2026-07-04",
    };
    const plan = buildBudgetPlanFromForm(form);
    expect(plan.total).toBe(1_000_000);
    const legacy = budgetPlanToLegacyAllocation(plan);
    expect(legacy.find((a) => a.id === "hotel")).toBeTruthy();
    expect(legacy.reduce((s, a) => s + a.amount, 0)).toBe(1_000_000);
  });

  it("한도 초과 일정은 clamp 돼요", () => {
    const form = {
      ...INITIAL_FORM,
      budget: "300000",
      people: 1,
      destination: "도쿄",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      dateType: "specific" as const,
    };
    const plan = buildBudgetPlanFromForm(form);
    const limit = variableLimitFromPlan(plan);
    const schedule: DaySchedule[] = [
      {
        day: 1,
        label: "1일차",
        dayTotal: limit * 3,
        items: [
          { time: "12:00", title: "점심", cost: limit },
          { time: "15:00", title: "관광", cost: limit },
          { time: "19:00", title: "저녁", cost: limit },
        ],
      },
    ];
    expect(scheduleExceedsBudgetPlan(schedule, plan)).toBe(true);
    const { schedule: next, clamped } = clampScheduleToBudgetPlan(
      schedule,
      plan
    );
    expect(clamped).toBe(true);
    expect(sumVariableScheduleCost(next)).toBeLessThanOrEqual(limit);
  });

  it("변동 한도가 0이면 변동비 일정을 0으로 clamp 해요", () => {
    const plan = buildBudgetPlanFromForm({
      ...INITIAL_FORM,
      budget: "0",
      people: 1,
      destination: "도쿄",
      dateType: "specific",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
    });
    expect(variableLimitFromPlan(plan)).toBe(0);
    const schedule: DaySchedule[] = [
      {
        day: 1,
        label: "1일차",
        dayTotal: 50_000,
        items: [{ time: "12:00", title: "점심", cost: 50_000 }],
      },
    ];
    const { schedule: next, clamped } = clampScheduleToBudgetPlan(
      schedule,
      plan
    );
    expect(clamped).toBe(true);
    expect(sumVariableScheduleCost(next)).toBe(0);
  });
});
