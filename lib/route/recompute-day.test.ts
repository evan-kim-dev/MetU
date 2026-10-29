import { describe, expect, it } from "vitest";
import { moveItem } from "@/lib/route/recompute-day";
import type { TripDaySchedule } from "@/lib/trips/types";

const sample = (): TripDaySchedule[] => [
  {
    day: 1,
    label: "1",
    dayTotal: 30,
    items: [
      { time: "14:00", title: "공항 도착", cost: 10, fixed: true },
      { time: "16:00", title: "카페", cost: 10, placeId: "a" },
      { time: "18:00", title: "저녁", cost: 10, placeId: "b" },
    ],
  },
  {
    day: 2,
    label: "2",
    dayTotal: 20,
    items: [
      { time: "10:00", title: "관광", cost: 10, placeId: "c" },
      { time: "12:00", title: "점심", cost: 10, placeId: "d" },
    ],
  },
];

describe("moveItem", () => {
  it("moves within the same day", () => {
    const next = moveItem(sample(), { day: 1, index: 1 }, { day: 1, index: 3 });
    expect(next[0]!.items.map((i) => i.title)).toEqual([
      "공항 도착",
      "저녁",
      "카페",
    ]);
    expect(next[0]!.items[2]!.placeId).toBe("a");
  });

  it("moves across days", () => {
    const next = moveItem(sample(), { day: 1, index: 2 }, { day: 2, index: 1 });
    expect(next[0]!.items.map((i) => i.title)).toEqual(["공항 도착", "카페"]);
    expect(next[1]!.items.map((i) => i.title)).toEqual([
      "관광",
      "저녁",
      "점심",
    ]);
    expect(next[0]!.dayTotal).toBe(20);
    expect(next[1]!.dayTotal).toBe(30);
  });

  it("rejects moving fixed items", () => {
    const base = sample();
    const next = moveItem(base, { day: 1, index: 0 }, { day: 2, index: 0 });
    expect(next).toBe(base);
  });

  it("ignores out-of-range index", () => {
    const base = sample();
    expect(moveItem(base, { day: 1, index: 99 }, { day: 2, index: 0 })).toBe(
      base
    );
  });
});
