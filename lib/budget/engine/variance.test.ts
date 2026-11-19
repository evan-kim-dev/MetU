import { describe, expect, it } from "vitest";
import { allocate } from "./allocate";
import { hasVarianceOver, REBALANCE_OVER_RATIO, variance } from "./variance";

describe("variance", () => {
  it("카테고리별 계획 대비 실제·초과율을 계산해요", () => {
    const plan = allocate({ total: 1_000_000, travelers: 2, nights: 3 });
    const foodLimit = plan.categories.food.limit;
    const rows = variance(plan, [
      { category: "food", krwAmount: Math.floor(foodLimit * 1.2) },
    ]);
    const food = rows.find((r) => r.category === "food")!;
    expect(food.planLimit).toBe(foodLimit);
    expect(food.overRatio).toBeCloseTo(1.2, 5);
    expect(hasVarianceOver(rows, REBALANCE_OVER_RATIO)).toBe(true);
  });

  it("15% 이하면 rebalance 트리거가 아니에요", () => {
    const plan = allocate({ total: 1_000_000, travelers: 2, nights: 3 });
    const foodLimit = plan.categories.food.limit;
    const rows = variance(plan, [
      { category: "food", krwAmount: Math.floor(foodLimit * 1.1) },
    ]);
    expect(hasVarianceOver(rows, REBALANCE_OVER_RATIO)).toBe(false);
  });

  it("한도 0에 지출이 있으면 overRatio null + 초과로 봐요", () => {
    const plan = allocate({ total: 0, travelers: 1, nights: 1 });
    const rows = variance(plan, [{ category: "etc", krwAmount: 1000 }]);
    expect(hasVarianceOver(rows)).toBe(true);
  });
});
