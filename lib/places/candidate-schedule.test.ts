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

  it("중간 일차는 직전 좌표에 가까운 순으로 이어져요", () => {
    // 한 클러스터에 들어가도록 가까운 점들만 사용
    const places: Place[] = [
      makePlace("far-a", "attraction", 34.8, 135.7),
      makePlace("near-a", "attraction", 34.69, 135.52),
      makePlace("near-food", "food", 34.6905, 135.5205),
      makePlace("near-shop", "shopping", 34.691, 135.521),
      makePlace("near-cafe", "cafe", 34.6915, 135.5215),
      makePlace("near-dinner", "food", 34.692, 135.522),
      makePlace("b1", "attraction", 34.5, 135.3),
      makePlace("b2", "food", 34.501, 135.301),
      makePlace("c1", "attraction", 35.0, 136.0),
      makePlace("c2", "food", 35.001, 136.001),
    ];
    const schedule = buildScheduleFromCandidates({
      ...base,
      places,
      nights: 2,
      styles: [...base.styles],
    });
    const mid = schedule[1];
    expect(mid).toBeTruthy();
    const coords = (mid?.items ?? []).filter(
      (i) => typeof i.lat === "number" && typeof i.lng === "number"
    );
    expect(coords.length).toBeGreaterThanOrEqual(2);
    // 연속 구간 하버사인 합이 첫→끝 직선을 크게 넘지 않으면 단방향에 가깝다
    let path = 0;
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1]!;
      const b = coords[i]!;
      const dLat = ((b.lat! - a.lat!) * Math.PI) / 180;
      const dLng = ((b.lng! - a.lng!) * Math.PI) / 180;
      const lat1 = (a.lat! * Math.PI) / 180;
      const lat2 = (b.lat! * Math.PI) / 180;
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      path += 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    expect(path).toBeLessThan(50);
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
