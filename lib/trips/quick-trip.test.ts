import { describe, expect, it, vi } from "vitest";
import { suggestTripDates } from "@/lib/ledger/trip-dates";
import { isInstantInTripWindow, seoulDateIso } from "@/lib/onboarding/trip-window";
import { buildQuickTrip } from "@/lib/trips/quick-trip";

describe("buildQuickTrip", () => {
  it("formats dateRange as ISO · N박 M일", () => {
    const trip = buildQuickTrip({
      destination: "도쿄",
      startIso: "2026-10-31",
      days: 5,
      now: new Date("2026-10-31T03:00:00Z"),
    });
    expect(trip.dateRange).toBe("2026-10-31 · 4박 5일");
  });

  it("suggestTripDates returns start/end from dateRange", () => {
    const trip = buildQuickTrip({
      destination: "도쿄",
      startIso: "2026-10-31",
      days: 5,
    });
    expect(suggestTripDates(trip.dateRange)).toEqual({
      startDate: "2026-10-31",
      endDate: "2026-11-04",
    });
  });

  it("clamps days to 1..30", () => {
    expect(
      buildQuickTrip({ destination: "도쿄", startIso: "2026-10-31", days: 0 })
        .dateRange
    ).toBe("2026-10-31 · 0박 1일");
    expect(
      buildQuickTrip({ destination: "도쿄", startIso: "2026-10-31", days: 99 })
        .dateRange
    ).toBe("2026-10-31 · 29박 30일");
  });

  it("sets ongoing for today and upcoming for tomorrow (Seoul)", () => {
    const now = new Date("2026-10-31T03:00:00Z"); // Seoul 12:00
    const today = seoulDateIso(now);
    expect(today).toBe("2026-10-31");
    expect(
      buildQuickTrip({
        destination: "도쿄",
        startIso: today,
        days: 3,
        now,
      }).status
    ).toBe("ongoing");
    expect(
      buildQuickTrip({
        destination: "도쿄",
        startIso: "2026-11-01",
        days: 3,
        now,
      }).status
    ).toBe("upcoming");
  });

  it("trims destination", () => {
    const trip = buildQuickTrip({
      destination: "  오사카  ",
      startIso: "2026-10-31",
      days: 2,
    });
    expect(trip.destination).toBe("오사카");
  });

  it("uses country from selection and defaults to empty", () => {
    expect(
      buildQuickTrip({
        destination: "도쿄, 일본",
        country: "일본",
        startIso: "2026-10-31",
        days: 2,
      }).country
    ).toBe("일본");
    expect(
      buildQuickTrip({
        destination: "강원대학교",
        startIso: "2026-10-31",
        days: 2,
      }).country
    ).toBe("");
  });

  it("trip window includes start noon and excludes end+2d", () => {
    const trip = buildQuickTrip({
      destination: "도쿄",
      startIso: "2026-10-31",
      days: 5,
    });
    const dates = suggestTripDates(trip.dateRange);
    expect(dates).not.toBeNull();
    const startMs = Date.parse(`${dates!.startDate}T12:00:00+09:00`);
    const outsideMs = Date.parse(`${dates!.endDate}T12:00:00+09:00`) + 2 * 86_400_000;
    expect(
      isInstantInTripWindow(startMs, dates!.startDate, dates!.endDate)
    ).toBe(true);
    expect(
      isInstantInTripWindow(outsideMs, dates!.startDate, dates!.endDate)
    ).toBe(false);
  });

  it("uses crypto.randomUUID for id", () => {
    const spy = vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-1111-1111-1111-111111111111"
    );
    const trip = buildQuickTrip({
      destination: "도쿄",
      startIso: "2026-10-31",
      days: 2,
    });
    expect(trip.id).toBe("11111111-1111-1111-1111-111111111111");
    spy.mockRestore();
  });
});
