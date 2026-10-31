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

  it("quick-trip label (ISO · N박 M일)", () => {
    expect(suggestTripDates("2026-10-31 · 4박 5일", "2026-10-30")).toEqual({
      startDate: "2026-10-31",
      endDate: "2026-11-04",
    });
  });

  it("returns null when unparseable", () => {
    expect(suggestTripDates("미정", "2026-01-01")).toBeNull();
  });

  it("parses month-day range", () => {
    const s = suggestTripDates("7월 20일 - 7월 25일", "2026-01-01");
    expect(s?.startDate).toBe("2026-07-20");
    expect(s?.endDate).toBe("2026-07-25");
  });

  it("parses dotted date range with omitted end year", () => {
    expect(suggestTripDates("2026.08.01~08.05", "2026-01-01")).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-05",
    });
    expect(suggestTripDates("2026.08.01 - 2026.08.05", "2026-01-01")).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-05",
    });
  });

  it("parses ISO range with two full dates", () => {
    expect(suggestTripDates("2026-07-20 ~ 2026-07-25", "2026-01-01")).toEqual({
      startDate: "2026-07-20",
      endDate: "2026-07-25",
    });
  });

  it("month-with-period label: nights wins, otherwise the 10-day period", () => {
    expect(suggestTripDates("2026년 8월 중순 · 5박", "2026-01-01")).toEqual({
      startDate: "2026-08-15",
      endDate: "2026-08-20",
    });
    expect(suggestTripDates("2026년 8월 중순", "2026-01-01")).toEqual({
      startDate: "2026-08-11",
      endDate: "2026-08-20",
    });
    expect(suggestTripDates("2026년 8월 말", "2026-01-01")).toEqual({
      startDate: "2026-08-21",
      endDate: "2026-08-31",
    });
  });

  it("year-less month-only label is not guessed", () => {
    expect(suggestTripDates("8월 중순", "2026-01-01")).toBeNull();
  });

  it("year-end → year-start keeps start <= end", () => {
    const s = suggestTripDates("12월 30일 - 1월 3일", "2026-01-01");
    expect(s).toEqual({ startDate: "2026-12-30", endDate: "2027-01-03" });
    expect(s!.startDate <= s!.endDate).toBe(true);
  });

  it("dotted year-end wrap 12.30~01.03", () => {
    expect(suggestTripDates("2026.12.30~01.03", "2026-01-01")).toEqual({
      startDate: "2026-12-30",
      endDate: "2027-01-03",
    });
  });

  it("year-less past date rolls to next year relative to the given today", () => {
    // D-day 용 동작: 오늘 기준 이미 지난 날짜는 내년. 알림 매칭은 resolveTripDatesForReceivedAt 가 보정한다.
    expect(suggestTripDates("7월 20일 - 7월 25일", "2026-08-01")?.startDate).toBe(
      "2027-07-20"
    );
    expect(suggestTripDates("7월 20일 - 7월 25일", "2026-07-21")?.startDate).toBe(
      "2027-07-20"
    );
    expect(suggestTripDates("7월 20일 - 7월 25일", "2026-07-20")?.startDate).toBe(
      "2026-07-20"
    );
  });
});
