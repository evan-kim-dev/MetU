import { describe, expect, it } from "vitest";
import { allocate } from "@/lib/budget/engine/allocate";
import {
  buildRebalanceProposal,
  cutRemainingPlanItems,
} from "@/lib/agent/rebalance-agent";
import type { PlanItem } from "@/lib/budget/types";

describe("cutRemainingPlanItems", () => {
  it("초과 카테고리 남은 일정을 잔여 한도에 맞춰 줄여요", () => {
    const plan = allocate({ total: 1_000_000, travelers: 2, nights: 3 });
    const foodLimit = plan.categories.food.limit;
    const variances = [
      {
        category: "food" as const,
        planLimit: foodLimit,
        actual: Math.floor(foodLimit * 0.8),
        delta: Math.floor(foodLimit * 0.8) - foodLimit,
        overRatio: 0.8,
      },
    ];
    const remaining: PlanItem[] = [
      {
        tripId: "t1",
        day: 2,
        time: "12:00",
        title: "점심",
        category: "food",
        estCost: foodLimit,
      },
    ];
    const { items, log } = cutRemainingPlanItems({ variances, remainingItems: remaining });
    const left = Math.max(0, foodLimit - Math.floor(foodLimit * 0.8));
    expect(items[0]!.estCost).toBe(left);
    expect(log.length).toBeGreaterThan(0);
  });

  it("flight/stay 는 건드리지 않아요", () => {
    const variances = [
      {
        category: "flight" as const,
        planLimit: 100_000,
        actual: 200_000,
        delta: 100_000,
        overRatio: 2,
      },
    ];
    const remaining: PlanItem[] = [
      {
        tripId: "t1",
        day: 1,
        time: "09:00",
        title: "항공",
        category: "flight",
        estCost: 50_000,
      },
    ];
    const { items, log } = cutRemainingPlanItems({ variances, remainingItems: remaining });
    expect(items[0]!.estCost).toBe(50_000);
    expect(log).toEqual([]);
  });
});

describe("buildRebalanceProposal", () => {
  it("15% 초과면 shouldSuggest true + 감축안", () => {
    const plan = { ...allocate({ total: 1_000_000, travelers: 2, nights: 3 }), tripId: "t1" };
    const foodLimit = plan.categories.food.limit;
    const remaining: PlanItem[] = [
      {
        tripId: "t1",
        day: 3,
        time: "19:00",
        title: "저녁",
        category: "food",
        estCost: Math.max(10_000, Math.floor(foodLimit * 0.5)),
      },
    ];
    const r = buildRebalanceProposal({
      plan,
      expenses: [{ category: "food", krwAmount: Math.floor(foodLimit * 1.2) }],
      remainingItems: remaining,
    });
    expect(r.shouldSuggest).toBe(true);
    expect(r.overCategories).toContain("food");
    expect(r.adjustedItems[0]!.estCost).toBeLessThanOrEqual(
      remaining[0]!.estCost
    );
    // 수락 전 원본 배열은 불변
    expect(remaining[0]!.estCost).toBe(
      Math.max(10_000, Math.floor(foodLimit * 0.5))
    );
  });

  it("한도 안이면 Suggestion 안 만들어요", () => {
    const plan = allocate({ total: 1_000_000, travelers: 2, nights: 3 });
    const foodLimit = plan.categories.food.limit;
    const r = buildRebalanceProposal({
      plan,
      expenses: [{ category: "food", krwAmount: Math.floor(foodLimit * 1.05) }],
      remainingItems: [],
    });
    expect(r.shouldSuggest).toBe(false);
  });
});
