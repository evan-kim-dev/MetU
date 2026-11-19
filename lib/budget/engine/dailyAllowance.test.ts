import { describe, expect, it } from "vitest";
import { allocate } from "./allocate";
import { dailyAllowance, remainingInclusiveDays } from "./dailyAllowance";

describe("dailyAllowance", () => {
  it("남은 변동 예산을 남은 일수로 나눠요", () => {
    const plan = allocate({
      total: 1_000_000,
      travelers: 2,
      nights: 4,
      destination: "도쿄",
    });
    // 고정비만 썼다고 가정 → 변동 전액 남음
    const r = dailyAllowance({
      plan,
      confirmedExpenses: [
        { category: "flight", krwAmount: plan.categories.flight.limit },
        { category: "stay", krwAmount: plan.categories.stay.limit },
      ],
      today: "2026-11-19",
      endDate: "2026-11-22",
    });
    expect(r.remainingDays).toBe(4);
    expect(r.spentVariableKrw).toBe(0);
    expect(r.allowanceKrw).toBe(Math.floor(r.remainingVariableKrw / 4));
  });

  it("변동 지출을 빼요", () => {
    const plan = allocate({
      total: 500_000,
      travelers: 1,
      nights: 2,
    });
    const foodLimit = plan.categories.food.limit;
    const r = dailyAllowance({
      plan,
      confirmedExpenses: [{ category: "food", krwAmount: Math.min(50_000, foodLimit) }],
      today: "2026-11-20",
      endDate: "2026-11-21",
    });
    expect(r.spentVariableKrw).toBe(Math.min(50_000, foodLimit));
    expect(r.remainingVariableKrw).toBe(
      r.variableBudgetKrw - r.spentVariableKrw
    );
  });

  it("종료일이 지났으면 남은 일수 0이에요", () => {
    expect(remainingInclusiveDays("2026-11-22", "2026-11-20")).toBe(0);
  });
});
