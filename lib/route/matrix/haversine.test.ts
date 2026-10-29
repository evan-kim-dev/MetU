import { describe, expect, it } from "vitest";
import { estimateLeg } from "@/lib/route/matrix/haversine";
import { parseDurationSec } from "@/lib/route/matrix/google";
import {
  parseTransitResponse,
  parseWalkResponse,
  parseWaypointsSections,
} from "@/lib/route/matrix/kakao";

describe("haversine estimateLeg", () => {
  it("WALK ~1km is a few minutes", () => {
    const leg = estimateLeg("WALK", 37.5, 127.0, 37.509, 127.0);
    expect(leg.distanceM).toBeGreaterThan(900);
    expect(leg.durationSec).toBeGreaterThan(10 * 60);
    expect(leg.durationSec).toBeLessThan(25 * 60);
  });

  it("TRANSIT 5km includes wait", () => {
    const leg = estimateLeg("TRANSIT", 37.5, 127.0, 37.545, 127.0);
    expect(leg.durationSec).toBeGreaterThan(5 * 60);
  });
});

describe("google duration parse", () => {
  it("parses 123s", () => {
    expect(parseDurationSec("123s")).toBe(123);
  });
});

describe("kakao response parsers", () => {
  it("parses walk totalTime", () => {
    expect(
      parseWalkResponse({
        status: "OK",
        route: { properties: { totalTime: 720, totalDistance: 900 } },
      })
    ).toEqual({ durationSec: 720, distanceM: 900 });
  });

  it("picks min totalTime transit route", () => {
    expect(
      parseTransitResponse({
        status: "OK",
        routes: [
          { properties: { totalTime: 1800, totalDistance: 5000 } },
          { properties: { totalTime: 1200, totalDistance: 4800 } },
        ],
      })
    ).toEqual({ durationSec: 1200, distanceM: 4800 });
  });

  it("parses waypoints sections", () => {
    const sections = parseWaypointsSections({
      routes: [
        {
          result_code: 0,
          sections: [
            { duration: 100, distance: 500 },
            { duration: 200, distance: 800 },
          ],
        },
      ],
    });
    expect(sections).toHaveLength(2);
  });
});
