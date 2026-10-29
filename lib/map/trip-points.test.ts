import { describe, expect, it } from "vitest";
import { boundsOf, extractMapPoints } from "@/lib/map/trip-points";
import { mapProviderFor } from "@/lib/map/provider";
import type { TripDaySchedule } from "@/lib/trips/types";

const days: TripDaySchedule[] = [
  {
    day: 1,
    label: "1일차",
    dayTotal: 0,
    items: [
      { time: "14:00", title: "공항", cost: 0 },
      {
        time: "18:30",
        title: "저녁",
        cost: 10000,
        lat: 37.5,
        lng: 127.0,
        hoursKnown: false,
        placeId: "p1",
      },
      {
        time: "16:00",
        title: "카페",
        cost: 0,
        lat: 37.51,
        lng: 127.01,
        hoursKnown: true,
      },
    ],
  },
];

describe("extractMapPoints", () => {
  it("excludes items without coordinates and assigns order by time", () => {
    const points = extractMapPoints(days);
    expect(points).toHaveLength(2);
    expect(points[0]!.title).toBe("카페");
    expect(points[0]!.order).toBe(1);
    expect(points[1]!.title).toBe("저녁");
    expect(points[1]!.hoursKnown).toBe(false);
  });
});

describe("boundsOf", () => {
  it("returns null for empty", () => {
    expect(boundsOf([])).toBeNull();
  });

  it("computes bounds", () => {
    const b = boundsOf(extractMapPoints(days));
    expect(b).not.toBeNull();
    expect(b!.north).toBeGreaterThanOrEqual(b!.south);
  });
});

describe("mapProviderFor", () => {
  it("KR + kakao key → kakao", () => {
    expect(mapProviderFor("KR", { kakao: true, google: true })).toBe("kakao");
  });

  it("KR + google only → google", () => {
    expect(mapProviderFor("KR", { kakao: false, google: true })).toBe("google");
  });

  it("GLOBAL + google → google", () => {
    expect(mapProviderFor("GLOBAL", { kakao: true, google: true })).toBe(
      "google"
    );
  });

  it("no keys → null", () => {
    expect(mapProviderFor("KR", { kakao: false, google: false })).toBeNull();
    expect(mapProviderFor("GLOBAL", { kakao: true, google: false })).toBeNull();
  });
});
