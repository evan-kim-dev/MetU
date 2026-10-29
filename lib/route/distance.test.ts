import { describe, expect, it } from "vitest";
import {
  buildDistanceMatrix,
  haversineKm,
  pathLengthKm,
} from "@/lib/route/distance";

describe("haversineKm", () => {
  it("서울시청–부산역 대략 거리 (~325km, ± 15km)", () => {
    const seoulCityHall = { lat: 37.5663, lng: 126.9779 };
    const busanStation = { lat: 35.1152, lng: 129.0413 };
    const km = haversineKm(seoulCityHall, busanStation);
    expect(km).toBeGreaterThan(310);
    expect(km).toBeLessThan(340);
  });
});

describe("buildDistanceMatrix / pathLengthKm", () => {
  it("대칭이고 대각선은 0", () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 0 },
    ];
    const m = buildDistanceMatrix(points);
    expect(m.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(m[i]![i]).toBe(0);
      for (let j = 0; j < 3; j++) {
        expect(m[i]![j]).toBeCloseTo(m[j]![i]!, 6);
      }
    }
  });

  it("pathLengthKm 은 구간 합", () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 0, lng: 2 },
    ];
    const m = buildDistanceMatrix(points);
    const total = pathLengthKm([0, 1, 2], m);
    expect(total).toBeCloseTo(m[0]![1]! + m[1]![2]!, 6);
  });
});
