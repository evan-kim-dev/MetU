import { describe, expect, it } from "vitest";
import {
  calcDailyBurnAllowance,
  convertKrwToLocal,
} from "@/lib/budget/burn-rate";

describe("calcDailyBurnAllowance", () => {
  it("고정비 제외 후 일×인으로 나눠요", () => {
    // (1_000_000 - 400_000) / (4일 × 2인) = 75_000
    expect(
      calcDailyBurnAllowance({
        totalBudget: 1_000_000,
        fixedCostKRW: 400_000,
        days: 4,
        people: 2,
      })
    ).toBe(75_000);
  });

  it("고정비가 예산을 넘으면 0이에요", () => {
    expect(
      calcDailyBurnAllowance({
        totalBudget: 100_000,
        fixedCostKRW: 200_000,
        days: 3,
        people: 1,
      })
    ).toBe(0);
  });
});

describe("convertKrwToLocal", () => {
  it("실청구 환율로 엔(100단위)을 환산해요", () => {
    // 75_000 / 932.75 * 100 ≈ 8040
    expect(
      convertKrwToLocal({
        amountKRW: 75_000,
        effectiveRate: 932.75,
        rateUnit: 100,
      })
    ).toBe(8040);
  });
});
