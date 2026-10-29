import { describe, expect, it } from "vitest";

import {
  isInstantInTripWindow,
  pickTripIdForReceivedAt,
  seoulDateIso,
  tripWindowBounds,
} from "@/lib/onboarding/trip-window";

describe("tripWindowBounds", () => {
  it("includes ±1 day slack around the trip", () => {
    const bounds = tripWindowBounds("2026-07-20", "2026-07-23", 1);
    expect(bounds).not.toBeNull();
    // 19th 00:00 KST
    expect(isInstantInTripWindow(Date.parse("2026-07-19T00:00:00+09:00"), "2026-07-20", "2026-07-23")).toBe(
      true
    );
    // 24th end of day KST
    expect(isInstantInTripWindow(Date.parse("2026-07-24T23:59:00+09:00"), "2026-07-20", "2026-07-23")).toBe(
      true
    );
    // 18th is outside
    expect(isInstantInTripWindow(Date.parse("2026-07-18T23:00:00+09:00"), "2026-07-20", "2026-07-23")).toBe(
      false
    );
    // 25th is outside
    expect(isInstantInTripWindow(Date.parse("2026-07-25T00:00:00+09:00"), "2026-07-20", "2026-07-23")).toBe(
      false
    );
  });
});

describe("pickTripIdForReceivedAt", () => {
  it("returns null when no trip matches", () => {
    const id = pickTripIdForReceivedAt(
      [{ id: "a", startDate: "2026-01-01", endDate: "2026-01-05" }],
      Date.parse("2026-07-20T12:00:00+09:00")
    );
    expect(id).toBeNull();
  });

  it("picks the trip with the closest start date among matches", () => {
    const received = Date.parse("2026-07-21T12:00:00+09:00");
    const id = pickTripIdForReceivedAt(
      [
        { id: "far", startDate: "2026-07-01", endDate: "2026-07-30" },
        { id: "near", startDate: "2026-07-20", endDate: "2026-07-23" },
      ],
      received
    );
    expect(id).toBe("near");
  });

  it("does not attach out-of-window events when dates expand later (caller re-runs)", () => {
    const received = Date.parse("2026-07-10T12:00:00+09:00");
    expect(
      pickTripIdForReceivedAt(
        [{ id: "t", startDate: "2026-07-20", endDate: "2026-07-22" }],
        received
      )
    ).toBeNull();
    expect(
      pickTripIdForReceivedAt(
        [{ id: "t", startDate: "2026-07-09", endDate: "2026-07-22" }],
        received
      )
    ).toBe("t");
  });
});

describe("seoulDateIso", () => {
  it("formats in Asia/Seoul", () => {
    // UTC evening may be next day in Seoul
    expect(seoulDateIso(new Date("2026-07-19T16:00:00Z"))).toBe("2026-07-20");
  });
});
