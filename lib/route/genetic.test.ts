import { describe, expect, it } from "vitest";
import { buildDistanceMatrix } from "@/lib/route/distance";
import { optimizeRouteGenetic } from "@/lib/route/genetic";

describe("optimizeRouteGenetic", () => {
  it("직선 위 점 6개 → 순서 또는 역순 최적 (n≤7 brute force)", () => {
    const points = Array.from({ length: 6 }, (_, i) => ({
      lat: 0,
      lng: i,
    }));
    const shuffledIdx = [3, 0, 5, 1, 4, 2];
    const shuffled = shuffledIdx.map((i) => points[i]!);
    const matrix = buildDistanceMatrix(shuffled);

    const result = optimizeRouteGenetic(6, matrix, { seed: 42 });
    const order = result.order;
    const forward = [0, 1, 2, 3, 4, 5];
    const reverse = [5, 4, 3, 2, 1, 0];
    // order is indices into shuffled points; map back to original lng order
    const lngOrder = order.map((i) => shuffled[i]!.lng);
    const isForward = lngOrder.every((v, i) => v === forward[i]);
    const isReverse = lngOrder.every((v, i) => v === reverse[i]);
    expect(isForward || isReverse).toBe(true);
  });

  it("동일 seed 면 결과 재현", () => {
    const points = [
      { lat: 1, lng: 1 },
      { lat: 2, lng: 3 },
      { lat: 0, lng: 4 },
      { lat: 5, lng: 0 },
      { lat: 3, lng: 2 },
      { lat: 4, lng: 5 },
      { lat: 2, lng: 2 },
      { lat: 6, lng: 1 },
    ];
    const matrix = buildDistanceMatrix(points);
    const a = optimizeRouteGenetic(points.length, matrix, { seed: 7 });
    const b = optimizeRouteGenetic(points.length, matrix, { seed: 7 });
    expect(a.order).toEqual(b.order);
    expect(a.lengthKm).toBeCloseTo(b.lengthKm, 6);
    expect(a.cost).toBeCloseTo(b.cost, 6);
  });

  it("costFn 미지정 시 cost 가 lengthKm 과 동일", () => {
    const points = [
      { lat: 1, lng: 1 },
      { lat: 2, lng: 3 },
      { lat: 0, lng: 4 },
      { lat: 5, lng: 0 },
      { lat: 3, lng: 2 },
      { lat: 4, lng: 5 },
      { lat: 2, lng: 2 },
      { lat: 6, lng: 1 },
    ];
    const matrix = buildDistanceMatrix(points);
    const result = optimizeRouteGenetic(points.length, matrix, { seed: 7 });
    expect(result.cost).toBeCloseTo(result.lengthKm, 6);
  });
});
