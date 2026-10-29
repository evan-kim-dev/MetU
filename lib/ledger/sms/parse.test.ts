import { describe, expect, it } from "vitest";
import { SYNTHETIC_SMS } from "@/lib/ledger/sms/__fixtures__/sms";
import {
  inferYear,
  parseCardSms,
  redactSms,
  splitSmsBatch,
} from "@/lib/ledger/sms/parse";

const ctx = { today: "2026-03-01" };

describe("parseCardSms fixtures", () => {
  it("shinhan credit overseas USD", () => {
    const r = parseCardSms(SYNTHETIC_SMS.shinhanCreditOverseas.text, ctx);
    expect(r.ok).toBe(true);
    expect(r.issuer).toBe("shinhan");
    expect(r.kind).toBe("approval");
    expect(r.currency).toBe("USD");
    expect(r.amount).toBe(4.48);
    expect(r.merchant?.toUpperCase()).toContain("AMAZON");
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("shinhan check overseas JPY", () => {
    const r = parseCardSms(SYNTHETIC_SMS.shinhanCheckOverseas.text, {
      today: "2026-12-10",
    });
    expect(r.ok).toBe(true);
    expect(r.currency).toBe("JPY");
    expect(r.amount).toBe(12205);
    expect(r.countryCode).toBe("JP");
  });

  it("samsung overseas", () => {
    const r = parseCardSms(SYNTHETIC_SMS.samsungOverseas.text, ctx);
    expect(r.ok).toBe(true);
    expect(r.issuer).toBe("samsung");
    expect(r.currency).toBe("USD");
    expect(r.amount).toBe(0.1);
  });

  it("hyundai usd/vnd", () => {
    const u = parseCardSms(SYNTHETIC_SMS.hyundaiUsd.text, {
      today: "2026-12-15",
    });
    expect(u.currency).toBe("USD");
    expect(u.amount).toBe(20.63);
    const v = parseCardSms(SYNTHETIC_SMS.hyundaiVnd.text, ctx);
    expect(v.currency).toBe("VND");
    expect(v.amount).toBe(46000);
  });

  it("domestic KRW", () => {
    for (const key of ["hanaDomestic", "samsungDomestic", "wooriDomestic"] as const) {
      const r = parseCardSms(SYNTHETIC_SMS[key].text, ctx);
      expect(r.domestic).toBe(true);
      expect(r.currency).toBe("KRW");
      expect(r.ok).toBe(true);
    }
  });

  it("cancel", () => {
    const r = parseCardSms(SYNTHETIC_SMS.hyundaiCancel.text, {
      today: "2026-12-25",
    });
    expect(r.kind).toBe("cancel");
    expect(r.amount).toBe(4930);
  });

  it("demo hotel jpy", () => {
    const r = parseCardSms(SYNTHETIC_SMS.demoHotelJpy.text, {
      today: "2026-11-05",
      tripStart: "2026-11-01",
      tripEnd: "2026-11-07",
    });
    expect(r.ok).toBe(true);
    expect(r.amount).toBe(45000);
    expect(r.currency).toBe("JPY");
    expect(r.spentOn).toBe("2026-11-03");
    expect(r.merchant).toMatch(/HOTEL/i);
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("dollar unknown warning", () => {
    const r = parseCardSms(SYNTHETIC_SMS.dollarUnknown.text, ctx);
    expect(r.warnings.some((w) => w.includes("달러"))).toBe(true);
    expect(r.currency).toBe("USD");
  });

  it("nonsense fails softly", () => {
    const r = parseCardSms("오늘 날씨 좋아요", ctx);
    expect(r.ok).toBe(false);
  });
});

describe("inferYear / batch / redact", () => {
  it("trip spanning Dec-Jan", () => {
    const y = inferYear(12, 30, {
      today: "2026-01-05",
      tripStart: "2025-12-20",
      tripEnd: "2026-01-05",
    });
    expect(y).toBe(2025);
  });

  it("splits batch", () => {
    const parts = splitSmsBatch(
      `${SYNTHETIC_SMS.hanaDomestic.text}\n\n${SYNTHETIC_SMS.samsungDomestic.text}`
    );
    expect(parts.length).toBe(2);
  });

  it("redacts PII", () => {
    const r = redactSms(SYNTHETIC_SMS.shinhanCreditOverseas.text);
    expect(r).not.toMatch(/이\*름/);
    expect(r).toMatch(/\[가림\]/);
    expect(r).not.toMatch(/누적1,/);
  });
});
