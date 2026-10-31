import { describe, expect, it } from "vitest";

import { parseCardSms } from "@/lib/ledger/sms/parse";
import { tripWindowBounds } from "@/lib/onboarding/trip-window";

import {
  buildDemoScenario,
  demoTripDates,
  stampSmsDate,
} from "./scenario";

describe("demo scenario", () => {
  it("stamps MM/DD HH:MM into synthetic text", () => {
    const out = stampSmsDate(
      "신한해외승인 11/03 21:40 HOTEL",
      "2026-10-31",
      "09:15"
    );
    expect(out).toContain("10/31 09:15");
    expect(out).not.toContain("11/03 21:40");
  });

  it("keeps received_at inside trip window (±1 day slack)", () => {
    const now = new Date("2026-10-31T12:00:00+09:00");
    const dates = demoTripDates(now);
    const bounds = tripWindowBounds(dates.startDate, dates.endDate, 1);
    expect(bounds).not.toBeNull();
    const scenario = buildDemoScenario(now);
    expect(scenario.length).toBeGreaterThanOrEqual(3);
    for (const step of scenario) {
      const ms = Date.parse(step.receivedAt);
      expect(Number.isNaN(ms)).toBe(false);
      expect(ms).toBeGreaterThanOrEqual(bounds!.startMs);
      expect(ms).toBeLessThanOrEqual(bounds!.endMs);
    }
  });

  it("parses each step with parseCardSms; cancel is kind cancel", () => {
    const now = new Date("2026-10-31T12:00:00+09:00");
    const dates = demoTripDates(now);
    const scenario = buildDemoScenario(now);
    for (const step of scenario) {
      const parsed = parseCardSms(step.text, {
        today: dates.today,
        tripStart: dates.startDate,
        tripEnd: dates.endDate,
      });
      expect(parsed.ok).toBe(true);
      if (step.fixtureKey === "hyundaiCancel") {
        expect(parsed.kind).toBe("cancel");
      } else {
        expect(parsed.kind).toBe("approval");
      }
    }
  });
});
