import { describe, expect, it } from "vitest";

import {
  budgetOverageCopy,
  deriveBudgetView,
  planEstimateKrw,
} from "@/lib/ledger/plan-estimate";

describe("planEstimateKrw", () => {
  it("일정 dayTotal 합을 우선해요", () => {
    expect(
      planEstimateKrw({
        dailySchedule: [
          { day: 1, label: "D1", items: [], dayTotal: 100_000 },
          { day: 2, label: "D2", items: [], dayTotal: 50_000 },
        ],
        budgetAllocation: [{ id: "a", label: "식비", amount: 999, percent: 1, color: "#" }],
      })
    ).toBe(150_000);
  });

  it("일정이 없으면 배분 합을 써요", () => {
    expect(
      planEstimateKrw({
        budgetAllocation: [
          { id: "a", label: "숙소", amount: 200_000, percent: 50, color: "#" },
          { id: "b", label: "식비", amount: 100_000, percent: 50, color: "#" },
        ],
      })
    ).toBe(300_000);
  });
});

describe("deriveBudgetView / overage", () => {
  it("한도 초과 문구", () => {
    const v = deriveBudgetView({ budget: 100, spent: 150, planKrw: 80 });
    expect(v.overLimit).toBe(true);
    expect(budgetOverageCopy(v)).toContain("확인이 필요해요");
  });

  it("플랜만 초과", () => {
    const v = deriveBudgetView({ budget: 200, spent: 150, planKrw: 100 });
    expect(v.overLimit).toBe(false);
    expect(v.overPlan).toBe(true);
    expect(budgetOverageCopy(v)).toContain("플랜 예상");
  });
});
