import { describe, expect, it } from "vitest";
import {
  budgetPlanFromAllocation,
  planItemsFromDailySchedule,
} from "./adapters";

describe("budget adapters", () => {
  it("hotel→stay, activity→etc 로 매핑해요", () => {
    const plan = budgetPlanFromAllocation({
      tripId: "t1",
      total: 100_000,
      people: 2,
      allocation: [
        { id: "hotel", label: "숙소", amount: 40_000 },
        { id: "activity", label: "관광", amount: 10_000 },
        { id: "food", label: "식비", amount: 50_000 },
      ],
    });
    expect(plan.categories.stay.limit).toBe(40_000);
    expect(plan.categories.etc.limit).toBe(10_000);
    expect(plan.categories.food.limit).toBe(50_000);
  });

  it("일정을 PlanItem 으로 펼쳐요", () => {
    const items = planItemsFromDailySchedule({
      tripId: "t1",
      dailySchedule: [
        {
          day: 1,
          items: [
            { time: "10:00", title: "카페", cost: 5000, category: "식비" },
          ],
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.category).toBe("food");
    expect(items[0]!.estCost).toBe(5000);
  });
});
