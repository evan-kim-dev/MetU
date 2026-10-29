import { describe, expect, it } from "vitest";
import {
  parseNightsFromDateRange,
  suggestTripDates,
} from "@/lib/ledger/trip-dates";

describe("suggestTripDates", () => {
  it("parses nights from date range", () => {
    expect(parseNightsFromDateRange("2026년 8월 중순 · 5박")).toBe(5);
    expect(parseNightsFromDateRange("주말")).toBeNull();
  });

  it("suggests start/end from ISO + nights", () => {
    const s = suggestTripDates("2026-07-20 · 3박", "2026-01-01");
    expect(s).toEqual({ startDate: "2026-07-20", endDate: "2026-07-23" });
  });

  it("returns null when unparseable", () => {
    expect(suggestTripDates("미정", "2026-01-01")).toBeNull();
  });

  it("parses month-day range", () => {
    const s = suggestTripDates("7월 20일 - 7월 25일", "2026-01-01");
    expect(s?.startDate).toBe("2026-07-20");
    expect(s?.endDate).toBe("2026-07-25");
  });
});
