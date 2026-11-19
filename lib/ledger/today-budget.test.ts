import { describe, expect, it } from "vitest";
import {
  dayBudgetFromTrip,
  deriveTodayBudget,
  sumSpentOnDate,
  tripDayCount,
} from "./today-budget";

describe("today-budget", () => {
  it("일 예산은 총예산÷일수예요", () => {
    expect(dayBudgetFromTrip({ totalBudgetKrw: 1_000_000, tripDays: 5 })).toBe(
      200_000
    );
  });

  it("오늘 소진만 합산해요", () => {
    const sum = sumSpentOnDate(
      [
        { spentOn: "2026-11-19", krwAmount: 10_000 },
        { spentOn: "2026-11-18", krwAmount: 99_000 },
        { spentOn: "2026-11-19", krwAmount: 5_000 },
      ],
      "2026-11-19"
    );
    expect(sum).toBe(15_000);
  });

  it("잔여·사용비율을 계산해요", () => {
    const v = deriveTodayBudget({
      totalBudgetKrw: 300_000,
      tripDays: 3,
      todayIso: "2026-11-19",
      expenses: [{ spentOn: "2026-11-19", krwAmount: 40_000 }],
    });
    expect(v.dayBudgetKrw).toBe(100_000);
    expect(v.spentTodayKrw).toBe(40_000);
    expect(v.remainingKrw).toBe(60_000);
    expect(v.usedRatio).toBeCloseTo(0.4);
  });

  it("여행 일수는 start~end 포함 일수예요", () => {
    expect(
      tripDayCount({ startDate: "2026-07-01", endDate: "2026-07-03" })
    ).toBe(3);
  });
});
