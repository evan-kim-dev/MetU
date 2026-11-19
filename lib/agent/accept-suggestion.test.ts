import { describe, expect, it } from "vitest";
import { mergeAdjustedIntoSchedule } from "@/lib/agent/suggestion-schedule";
import type { PlanItem } from "@/lib/budget/types";

describe("mergeAdjustedIntoSchedule", () => {
  it("기존 일정 비용을 adjustedItems 로 바꿔요 (수락 시에만 호출)", () => {
    const current = [
      {
        day: 1,
        label: "1일차",
        items: [
          { time: "12:00", title: "점심", cost: 20_000 },
          { time: "19:00", title: "저녁", cost: 30_000 },
        ],
        dayTotal: 50_000,
      },
    ];
    const adjusted: PlanItem[] = [
      {
        tripId: "t1",
        day: 1,
        time: "12:00",
        title: "점심",
        category: "food",
        estCost: 8_000,
      },
      {
        tripId: "t1",
        day: 1,
        time: "19:00",
        title: "저녁",
        category: "food",
        estCost: 12_000,
      },
    ];
    const next = mergeAdjustedIntoSchedule(current, adjusted) as Array<{
      items: Array<{ cost: number }>;
      dayTotal: number;
    }>;
    expect(next[0]!.items[0]!.cost).toBe(8_000);
    expect(next[0]!.items[1]!.cost).toBe(12_000);
    expect(next[0]!.dayTotal).toBe(20_000);
    // 원본 불변
    expect(current[0]!.items[0]!.cost).toBe(20_000);
  });
});
