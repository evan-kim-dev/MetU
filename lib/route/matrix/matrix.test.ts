import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMatrixCache } from "@/lib/route/matrix/cache";
import { parseDurationSec } from "@/lib/route/matrix/google";
import {
  buildHaversineMatrix,
  estimateLeg,
  TRANSIT_WALK_THRESHOLD_M,
} from "@/lib/route/matrix/haversine";
import {
  parseTransitResponse,
  parseWalkResponse,
  parseWaypointsSections,
  refineKakaoLegs,
} from "@/lib/route/matrix/kakao";
import { getTravelMatrix, refineLegsForOrder } from "@/lib/route/matrix/index";
import type { MatrixPoint, TravelMatrix } from "@/lib/route/matrix/types";

const seoul: MatrixPoint[] = [
  { id: "a", lat: 37.5665, lng: 126.978 },
  { id: "b", lat: 37.5702, lng: 126.982 },
  { id: "c", lat: 37.5796, lng: 126.977 },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearMatrixCache();
  delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
  delete process.env.KAKAO_REST_API_KEY;
  delete process.env.ROUTE_MATRIX_PROVIDER;
});

describe("haversine estimates", () => {
  it("WALK 1km straight leg", () => {
    const leg = estimateLeg("WALK", 37.5, 127.0, 37.509, 127.0);
    expect(leg.distanceM).toBeGreaterThan(900);
    expect(leg.durationSec).toBeGreaterThan(600);
  });

  it("TRANSIT 5km uses transit speed + wait", () => {
    const km = 5;
    const lat2 = 37.5 + km / 111;
    const walk = estimateLeg("TRANSIT", 37.5, 127.0, 37.5 + 0.005, 127.0);
    expect(walk.durationSec).toBeLessThan(600);
    const transit = estimateLeg("TRANSIT", 37.5, 127.0, lat2, 127.0);
    expect(transit.durationSec).toBeGreaterThan(300);
    expect(TRANSIT_WALK_THRESHOLD_M).toBe(1500);
  });
});

describe("parseDurationSec", () => {
  it('parses "123s"', () => {
    expect(parseDurationSec("123s")).toBe(123);
  });
});

describe("kakao response parsers", () => {
  it("walk totalTime", () => {
    const leg = parseWalkResponse({
      status: "OK",
      route: { properties: { totalTime: 420, totalDistance: 500 } },
    });
    expect(leg?.durationSec).toBe(420);
  });

  it("transit picks minimum totalTime", () => {
    const leg = parseTransitResponse({
      status: "OK",
      routes: [
        { properties: { totalTime: 900 } },
        { properties: { totalTime: 600 } },
      ],
    });
    expect(leg?.durationSec).toBe(600);
  });

  it("waypoints sections length matches legs", () => {
    const sections = parseWaypointsSections({
      routes: [
        {
          result_code: 0,
          sections: [
            { duration: 100, distance: 200 },
            { duration: 150, distance: 250 },
          ],
        },
      ],
    });
    expect(sections?.length).toBe(2);
  });
});

describe("getTravelMatrix google parsing", () => {
  it("fills matrix and marks missing cells estimated", async () => {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = "test-key";
    process.env.ROUTE_MATRIX_PROVIDER = "google";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            originIndex: 0,
            destinationIndex: 1,
            status: "OK",
            condition: "ROUTE_EXISTS",
            duration: "600s",
            distanceMeters: 800,
          },
          {
            originIndex: 1,
            destinationIndex: 0,
            status: "ROUTE_NOT_FOUND",
          },
        ],
      }))
    );

    const matrix = await getTravelMatrix(seoul.slice(0, 2), "WALK", {
      region: "GLOBAL",
    });
    expect(matrix.durationsSec[0]![1]).toBe(600);
    expect(matrix.estimatedCells.some(([i, j]) => i === 1 && j === 0)).toBe(
      true
    );
  });
});

describe("refineLegsForOrder", () => {
  it("replaces adjacent cells only", async () => {
    process.env.KAKAO_REST_API_KEY = "kakao-key";
    process.env.ROUTE_MATRIX_PROVIDER = "kakao";

    const base = buildHaversineMatrix(
      "WALK",
      seoul.map((p) => p.lat),
      seoul.map((p) => p.lng)
    );
    const matrix: TravelMatrix = {
      mode: "WALK",
      durationsSec: base.durationsSec,
      distancesM: base.distancesM,
      source: "haversine",
      region: "KR",
      estimatedCells: [...base.estimatedCells],
    };
    const before01 = matrix.durationsSec[0]![1];

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: "OK",
          route: { properties: { totalTime: 111, totalDistance: 222 } },
        }),
      }))
    );

    const refined = await refineKakaoLegs(
      seoul,
      [0, 1, 2],
      "WALK",
      matrix.durationsSec,
      matrix.distancesM,
      matrix.estimatedCells
    );
    expect(refined.durationsSec[0]![1]).toBe(111);
    expect(refined.durationsSec[0]![2]).toBe(matrix.durationsSec[0]![2]);
    expect(refined.durationsSec[0]![1]).not.toBe(before01);
    expect(refined.anyRefined).toBe(true);
  });

  it("GLOBAL refineLegsForOrder is no-op", async () => {
    const base = buildHaversineMatrix(
      "WALK",
      seoul.map((p) => p.lat),
      seoul.map((p) => p.lng)
    );
    const matrix: TravelMatrix = {
      mode: "WALK",
      ...base,
      source: "haversine",
      region: "GLOBAL",
    };
    const out = await refineLegsForOrder(matrix, seoul, [0, 1, 2]);
    expect(out).toBe(matrix);
  });
});
