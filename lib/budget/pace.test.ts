import { describe, expect, it } from "vitest";
import {
  assessDailyPace,
  averageDayTotal,
} from "@/lib/budget/pace";

describe("assessDailyPace", () => {
  it("한도 ±10% 안이면 on_pace", () => {
    expect(
      assessDailyPace({ plannedDayTotalKRW: 72_000, allowanceKRW: 75_000 })
        .status
    ).toBe("on_pace");
  });

  it("크게 초과하면 over", () => {
    const r = assessDailyPace({
      plannedDayTotalKRW: 120_000,
      allowanceKRW: 75_000,
    });
    expect(r.status).toBe("over");
    expect(r.deltaKRW).toBe(45_000);
  });

  it("크게 남으면 under", () => {
    expect(
      assessDailyPace({ plannedDayTotalKRW: 40_000, allowanceKRW: 75_000 })
        .status
    ).toBe("under");
  });
});

describe("averageDayTotal", () => {
  it("일평균을 정수로 돌려요", () => {
    expect(
      averageDayTotal([{ dayTotal: 100_000 }, { dayTotal: 50_000 }])
    ).toBe(75_000);
  });
});
