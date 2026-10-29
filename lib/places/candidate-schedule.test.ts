import { describe, expect, it } from "vitest";
import { buildScheduleFromCandidates } from "@/lib/places/candidate-schedule";
import type { Place } from "@/lib/places/types";

function makePlace(
  id: string,
  kind: Place["kind"],
  lat: number,
  lng: number
): Place {
  return {
    id: `uuid-${id}`,
    provider: "google",
    providerPlaceId: id,
    name: `Place ${id}`,
    lat,
    lng,
    kind,
    types: [kind],
    city: "오사카",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    rating: 4.5,
    userRatingCount: 200,
  };
}

const samplePlaces: Place[] = [
  makePlace("a1", "attraction", 34.69, 135.52),
  makePlace("a2", "attraction", 34.691, 135.521),
  makePlace("f1", "food", 34.692, 135.522),
  makePlace("f2", "food", 34.693, 135.523),
  makePlace("s1", "shopping", 34.7, 135.53),
  makePlace("c1", "cafe", 34.701, 135.531),
  makePlace("a3", "attraction", 34.68, 135.5),
  makePlace("f3", "food", 34.681, 135.501),
  makePlace("a4", "attraction", 34.71, 135.54),
  makePlace("f4", "food", 34.711, 135.541),
];

describe("buildScheduleFromCandidates", () => {
  const base = {
    places: samplePlaces,
    nights: 2,
    styles: ["food", "sightseeing"] as const,
    budgets: { food: 40000, activity: 30000, transport: 10000 },
    city: "오사카",
    origin: "서울",
  };

  it("returns nights+1 days", () => {
    const schedule = buildScheduleFromCandidates({
      ...base,
      styles: [...base.styles],
    });
    expect(schedule).toHaveLength(3);
    expect(schedule.map((d) => d.day)).toEqual([1, 2, 3]);
  });

  it("is deterministic", () => {
    const a = buildScheduleFromCandidates({
      ...base,
      styles: [...base.styles],
    });
    const b = buildScheduleFromCandidates({
      ...base,
      styles: [...base.styles],
    });
    expect(a).toEqual(b);
  });

  it("puts coordinates on candidate-backed items", () => {
    const schedule = buildScheduleFromCandidates({
      ...base,
      styles: [...base.styles],
    });
    const placed = schedule.flatMap((d) =>
      d.items.filter((i) => i.providerPlaceId)
    );
    expect(placed.length).toBeGreaterThan(0);
    for (const item of placed) {
      expect(typeof item.lat).toBe("number");
      expect(typeof item.lng).toBe("number");
    }
  });

  it("returns empty array when no candidates", () => {
    const schedule = buildScheduleFromCandidates({
      ...base,
      places: [],
      styles: [...base.styles],
    });
    expect(schedule).toEqual([]);
  });
});
