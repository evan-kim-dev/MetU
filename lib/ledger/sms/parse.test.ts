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

const ctxP2 = { today: "2026-03-10" };

describe("parseCardSms P2 issuers", () => {
  const cases: {
    key: keyof typeof SYNTHETIC_SMS;
    issuer: string;
    currency: string;
    amount: number;
    merchant: RegExp;
    domestic: boolean;
    countryCode?: string;
  }[] = [
    { key: "lotteDomestic", issuer: "lotte", currency: "KRW", amount: 12500, merchant: /^스타벅스$/, domestic: true },
    { key: "lotteInstallment", issuer: "lotte", currency: "KRW", amount: 120000, merchant: /^전자랜드$/, domestic: true },
    { key: "lotteOverseas", issuer: "lotte", currency: "USD", amount: 12.34, merchant: /AMAZON/, domestic: false },
    { key: "nhDomestic", issuer: "nh", currency: "KRW", amount: 9800, merchant: /^GS25$/, domestic: true },
    { key: "nhOverseas", issuer: "nh", currency: "JPY", amount: 12205, merchant: /^LAWSON$/, domestic: false, countryCode: "JP" },
    { key: "bcDomestic", issuer: "bc", currency: "KRW", amount: 4500, merchant: /^파리바게뜨$/, domestic: true },
    { key: "bcOverseas", issuer: "bc", currency: "USD", amount: 4.48, merchant: /AMAZON/, domestic: false, countryCode: "US" },
    { key: "kakaobankDomestic", issuer: "kakaobank", currency: "KRW", amount: 3200, merchant: /^CU편의점$/, domestic: true },
    { key: "kakaobankOverseas", issuer: "kakaobank", currency: "VND", amount: 46000, merchant: /PHUQUOC/, domestic: false },
    { key: "tossbankDomestic", issuer: "tossbank", currency: "KRW", amount: 5500, merchant: /^배달의민족$/, domestic: true },
    { key: "tossbankOverseas", issuer: "tossbank", currency: "SGD", amount: 12.5, merchant: /^GRAB$/, domestic: false, countryCode: "SG" },
    { key: "kbDomestic", issuer: "kb", currency: "KRW", amount: 2300, merchant: /^이마트24$/, domestic: true },
    { key: "kbOverseas", issuer: "kb", currency: "JPY", amount: 3500, merchant: /^DONKI$/, domestic: false },
    { key: "hyundaiDomestic", issuer: "hyundai", currency: "KRW", amount: 8900, merchant: /^올리브영$/, domestic: true },
    { key: "hyundaiInstallment", issuer: "hyundai", currency: "KRW", amount: 240000, merchant: /^하이마트$/, domestic: true },
  ];

  for (const c of cases) {
    it(`approval ${String(c.key)}`, () => {
      const r = parseCardSms(SYNTHETIC_SMS[c.key].text, ctxP2);
      expect(r.ok).toBe(true);
      expect(r.kind).toBe("approval");
      expect(r.issuer).toBe(c.issuer);
      expect(r.currency).toBe(c.currency);
      expect(r.amount).toBe(c.amount);
      expect(r.domestic).toBe(c.domestic);
      expect(r.merchant).toMatch(c.merchant);
      expect(r.spentOn).toMatch(/^2026-03-\d{2}$/);
      expect(r.confidence).toBeGreaterThanOrEqual(0.8);
      expect(r.warnings).toEqual([]);
      if (c.countryCode) expect(r.countryCode).toBe(c.countryCode);
    });
  }

  it("ignores cumulative amount and Web발신 marker", () => {
    const r = parseCardSms(SYNTHETIC_SMS.lotteDomestic.text, ctxP2);
    expect(r.amount).toBe(12500);
    expect(r.merchant).not.toMatch(/누적|Web/);
  });

  const cancels = [
    { key: "lotteCancel", issuer: "lotte", amount: 12500, merchant: /^스타벅스$/ },
    { key: "nhCancel", issuer: "nh", amount: 9800, merchant: /^GS25$/ },
    { key: "bcCancel", issuer: "bc", amount: 4500, merchant: /^파리바게뜨$/ },
    { key: "kakaobankCancel", issuer: "kakaobank", amount: 3200, merchant: /^CU편의점$/ },
    { key: "tossbankCancel", issuer: "tossbank", amount: 5500, merchant: /^배달의민족$/ },
    { key: "kbCancel", issuer: "kb", amount: 2300, merchant: /^이마트24$/ },
  ] as const;

  for (const c of cancels) {
    it(`cancel ${c.key}`, () => {
      const r = parseCardSms(SYNTHETIC_SMS[c.key].text, ctxP2);
      expect(r.kind).toBe("cancel");
      expect(r.ok).toBe(true);
      expect(r.issuer).toBe(c.issuer);
      expect(r.amount).toBe(c.amount);
      expect(r.currency).toBe("KRW");
      expect(r.merchant).toMatch(c.merchant);
      expect(r.confidence).toBeLessThanOrEqual(0.9);
    });
  }

  it("dollar with unknown country warns and lowers confidence (no guessing)", () => {
    const known = parseCardSms(SYNTHETIC_SMS.bcOverseas.text, ctxP2);
    const unknown = parseCardSms(
      SYNTHETIC_SMS.lotteDollarUnknownCountry.text,
      ctxP2
    );
    expect(unknown.warnings.some((w) => w.includes("달러"))).toBe(true);
    expect(unknown.confidence).toBeLessThan(known.confidence);
  });

  it("dollar with country maps via DOLLAR_BY_COUNTRY (SG → SGD)", () => {
    const r = parseCardSms(SYNTHETIC_SMS.tossbankOverseas.text, ctxP2);
    expect(r.currency).toBe("SGD");
    expect(r.warnings).toEqual([]);
  });

  it("does not treat merchant caps (CGV) as a currency", () => {
    const r = parseCardSms(
      "[Web발신] 롯데카드(1234) 해외승인 홍*동 12.34 USD 03/03 09:15 CGV 강남",
      ctxP2
    );
    expect(r.currency).toBe("USD");
    expect(r.amount).toBe(12.34);
    expect(r.merchant).toMatch(/CGV/);
  });

  const negatives = [
    "negativeOtp",
    "negativeAd",
    "negativeDeposit",
    "negativeTransferApproval",
    "negativeCumulativeOnly",
  ] as const;

  for (const key of negatives) {
    it(`negative ${key} does not parse as approval`, () => {
      const r = parseCardSms(SYNTHETIC_SMS[key].text, ctxP2);
      expect(r.ok).toBe(false);
      expect(r.kind).toBe("unknown");
      expect(r.amount).toBeNull();
      expect(r.confidence).toBeLessThan(0.3);
    });
  }
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
