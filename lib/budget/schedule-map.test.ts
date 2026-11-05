import { describe, expect, it } from "vitest";
import type { DaySchedule } from "@/lib/ai/types";
import {
  applyRebalanceCostsToSchedule,
  previewDiscretionaryGap,
  scheduleToRebalanceItems,
} from "@/lib/budget/schedule-map";

const sample: DaySchedule[] = [
  {
    day: 1,
    label: "시작",
    dayTotal: 80_000,
    items: [
      { time: "12:00", title: "라멘", cost: 50_000, kind: "food" },
      { time: "15:00", title: "사원", cost: 30_000, kind: "attraction" },
    ],
  },
];

describe("scheduleToRebalanceItems", () => {
  it("식비·고정 스팟을 구분해요", () => {
    const items = scheduleToRebalanceItems(sample);
    expect(items).toHaveLength(2);
    expect(items[0]?.category).toBe("meal");
    expect(items[0]?.isFixed).toBe(false);
    expect(items[1]?.isFixed).toBe(true);
  });
});

describe("applyRebalanceCostsToSchedule", () => {
  it("조정 금액을 일정에 반영해요", () => {
    const items = scheduleToRebalanceItems(sample);
    items[0]!.costKRW = 40_000;
    const next = applyRebalanceCostsToSchedule(sample, items);
    expect(next[0]?.items[0]?.cost).toBe(40_000);
    expect(next[0]?.dayTotal).toBe(70_000);
  });
});

describe("previewDiscretionaryGap", () => {
  it("초과분을 계산해요", () => {
    const { scheduleTotal, gap } = previewDiscretionaryGap({
      schedule: sample,
      targetDiscretionaryBudget: 60_000,
    });
    expect(scheduleTotal).toBe(80_000);
    expect(gap).toBe(20_000);
  });
});
