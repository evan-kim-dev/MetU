import { describe, expect, it } from "vitest";
import { allocate } from "@/lib/budget/engine/allocate";
import {
  dropSoftItemsToFitBudget,
  proposeScheduleAfterCardNotify,
} from "@/lib/agent/card-notify-schedule";
import type { PlanItem } from "@/lib/budget/types";

describe("dropSoftItemsToFitBudget", () => {
  it("남은 예산 안이면 드롭하지 않아요", () => {
    const items: PlanItem[] = [
      {
        tripId: "t1",
        day: 2,
        time: "12:00",
        title: "점심",
        category: "food",
        estCost: 30_000,
      },
    ];
    const r = dropSoftItemsToFitBudget({
      items,
      remainingBudgetKrw: 100_000,
    });
    expect(r.dropped).toEqual([]);
    expect(r.items[0]!.estCost).toBe(30_000);
  });

  it("나중 day·큰 soft 부터 estCost=0 으로 맞춰요", () => {
    const items: PlanItem[] = [
      {
        tripId: "t1",
        day: 1,
        time: "12:00",
        title: "점심",
        category: "food",
        estCost: 40_000,
      },
      {
        tripId: "t1",
        day: 3,
        time: "19:00",
        title: "디너쇼",
        category: "etc",
        estCost: 80_000,
      },
      {
        tripId: "t1",
        day: 2,
        time: "15:00",
        title: "카페",
        category: "food",
        estCost: 20_000,
      },
    ];
    const r = dropSoftItemsToFitBudget({
      items,
      remainingBudgetKrw: 50_000,
    });
    expect(r.dropped.map((d) => d.title)).toEqual(["디너쇼", "카페"]);
    expect(r.items.find((i) => i.title === "디너쇼")!.estCost).toBe(0);
    expect(r.items.find((i) => i.title === "카페")!.estCost).toBe(0);
    expect(r.items.find((i) => i.title === "점심")!.estCost).toBe(40_000);
    expect(items[1]!.estCost).toBe(80_000);
  });

  it("flight/stay 는 드롭하지 않아요", () => {
    const items: PlanItem[] = [
      {
        tripId: "t1",
        day: 5,
        time: "09:00",
        title: "귀국편",
        category: "flight",
        estCost: 200_000,
      },
      {
        tripId: "t1",
        day: 4,
        time: "20:00",
        title: "야시장",
        category: "etc",
        estCost: 50_000,
      },
    ];
    const r = dropSoftItemsToFitBudget({
      items,
      remainingBudgetKrw: 10_000,
    });
    expect(r.dropped.map((d) => d.title)).toEqual(["야시장"]);
    expect(r.items.find((i) => i.title === "귀국편")!.estCost).toBe(200_000);
  });
});

describe("proposeScheduleAfterCardNotify", () => {
  it("카드 결제 뒤 일정 추정이 남은 예산을 넘으면 드롭 제안해요", () => {
    const plan = {
      ...allocate({ total: 500_000, travelers: 2, nights: 3 }),
      tripId: "t1",
    };
    const remaining: PlanItem[] = [
      {
        tripId: "t1",
        day: 1,
        time: "12:00",
        title: "점심",
        category: "food",
        estCost: 80_000,
      },
      {
        tripId: "t1",
        day: 3,
        time: "14:00",
        title: "테마파크",
        category: "etc",
        estCost: 200_000,
      },
    ];
    const r = proposeScheduleAfterCardNotify({
      plan,
      expenses: [{ category: "food", krwAmount: 300_000 }],
      remainingItems: remaining,
      latestCard: { merchant: "스시야", krwAmount: 80_000 },
    });
    expect(r.source).toBe("card-notify");
    expect(r.remainingBudgetKrw).toBe(200_000);
    expect(r.remainingScheduleEstKrw).toBe(280_000);
    expect(r.gapKrw).toBe(80_000);
    expect(r.shouldSuggest).toBe(true);
    expect(r.dropped.some((d) => d.title === "테마파크")).toBe(true);
    expect(r.message).toContain("스시야");
    expect(r.message).toContain("남은 예산");
  });

  it("예산·일정 모두 여유면 Suggestion 안 만들어요", () => {
    const plan = {
      ...allocate({ total: 1_000_000, travelers: 2, nights: 3 }),
      tripId: "t1",
    };
    const foodLimit = plan.categories.food.limit;
    const r = proposeScheduleAfterCardNotify({
      plan,
      expenses: [{ category: "food", krwAmount: Math.floor(foodLimit * 0.5) }],
      remainingItems: [
        {
          tripId: "t1",
          day: 2,
          time: "12:00",
          title: "점심",
          category: "food",
          estCost: 20_000,
        },
      ],
    });
    expect(r.shouldSuggest).toBe(false);
    expect(r.dropped).toEqual([]);
    expect(r.gapKrw).toBeLessThanOrEqual(0);
  });
});
