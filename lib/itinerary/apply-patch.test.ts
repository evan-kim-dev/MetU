import { describe, expect, it } from "vitest";
import { applyPatch } from "@/lib/itinerary/apply-patch";
import type { PatchScheduleCandidate } from "@/lib/itinerary/apply-patch";
import type { TripDaySchedule } from "@/lib/trips/types";

const cand = (
  id: string,
  name: string
): PatchScheduleCandidate => ({
  id,
  name,
  kind: "food",
  lat: 1,
  lng: 2,
  provider: "google",
  providerPlaceId: id,
});

const days = (): TripDaySchedule[] => [
  {
    day: 1,
    label: "1",
    dayTotal: 20,
    items: [
      { time: "14:00", title: "공항 도착", cost: 10, fixed: true },
      { time: "18:00", title: "저녁A", cost: 10, placeId: "a" },
    ],
  },
  {
    day: 2,
    label: "2",
    dayTotal: 10,
    items: [{ time: "12:00", title: "점심B", cost: 10, placeId: "b" }],
  },
];

describe("applyPatch", () => {
  const map = new Map<string, PatchScheduleCandidate>([
    ["c", cand("c", "해산물집")],
  ]);

  it("replaces place while keeping time", () => {
    const next = applyPatch(
      days(),
      [{ op: "replace", day: 1, index: 1, newPlaceId: "c" }],
      map
    );
    expect(next[0]!.items[1]!.title).toBe("해산물집");
    expect(next[0]!.items[1]!.time).toBe("18:00");
    expect(next[0]!.items[1]!.placeId).toBe("c");
  });

  it("protects fixed items", () => {
    const next = applyPatch(
      days(),
      [{ op: "replace", day: 1, index: 0, newPlaceId: "c" }],
      map
    );
    expect(next[0]!.items[0]!.title).toBe("공항 도착");
  });

  it("moves across days", () => {
    const next = applyPatch(
      days(),
      [{ op: "move", day: 1, index: 1, toDay: 2, toIndex: 0 }],
      map
    );
    expect(next[0]!.items).toHaveLength(1);
    expect(next[1]!.items[0]!.placeId).toBe("a");
  });

  it("ignores out-of-range index", () => {
    const next = applyPatch(
      days(),
      [{ op: "remove", day: 1, index: 99 }],
      map
    );
    expect(next[0]!.items).toHaveLength(2);
  });
});
