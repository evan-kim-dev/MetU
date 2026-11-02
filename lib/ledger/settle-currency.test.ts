import { describe, expect, it } from "vitest";
import {
  convertKrw,
  convertTransfers,
  effectiveRate,
  fixedRateMessage,
  formatConvertedAmount,
  formatRateText,
  validateFixedRate,
} from "@/lib/ledger/settle-currency";

describe("validateFixedRate", () => {
  it("accepts positive numbers and numeric strings (commas/spaces ignored)", () => {
    expect(validateFixedRate(9.1)).toEqual({ ok: true, rate: 9.1 });
    expect(validateFixedRate(" 1,380.5 ")).toEqual({ ok: true, rate: 1380.5 });
  });

  it("rejects non-numbers, zero and negatives", () => {
    expect(validateFixedRate("abc")).toEqual({
      ok: false,
      reason: "not-a-number",
    });
    expect(validateFixedRate("")).toEqual({
      ok: false,
      reason: "not-a-number",
    });
    expect(validateFixedRate(Number.NaN)).toEqual({
      ok: false,
      reason: "not-a-number",
    });
    expect(validateFixedRate(0)).toEqual({ ok: false, reason: "non-positive" });
    expect(validateFixedRate(-3)).toEqual({
      ok: false,
      reason: "non-positive",
    });
  });

  it("rejects rates far from the live rate (digit typos), keeps nearby ones", () => {
    const live = 10;
    expect(validateFixedRate(100, live)).toEqual({
      ok: false,
      reason: "far-from-live",
    });
    expect(validateFixedRate(1, live)).toEqual({
      ok: false,
      reason: "far-from-live",
    });
    expect(validateFixedRate(9.5, live)).toEqual({ ok: true, rate: 9.5 });
    expect(validateFixedRate(50, live)).toEqual({ ok: true, rate: 50 });
  });

  it("ignores an invalid live rate when range-checking", () => {
    expect(validateFixedRate(1000, null)).toEqual({ ok: true, rate: 1000 });
    expect(validateFixedRate(1000, 0)).toEqual({ ok: true, rate: 1000 });
  });

  it("has a Korean message for every reason", () => {
    for (const r of ["not-a-number", "non-positive", "far-from-live"] as const) {
      expect(fixedRateMessage(r)).toMatch(/[가-힣]/);
    }
  });
});

describe("effectiveRate", () => {
  it("prefers a valid fixed rate over live", () => {
    expect(effectiveRate({ liveRate: 9, fixedRate: "9.5" })).toEqual({
      rate: 9.5,
      source: "fixed",
    });
  });

  it("falls back to live when fixed is empty or invalid", () => {
    expect(effectiveRate({ liveRate: 9, fixedRate: "" })).toEqual({
      rate: 9,
      source: "live",
    });
    expect(effectiveRate({ liveRate: 9, fixedRate: null })).toEqual({
      rate: 9,
      source: "live",
    });
    expect(effectiveRate({ liveRate: 9, fixedRate: "abc" })).toEqual({
      rate: 9,
      source: "live",
    });
    expect(effectiveRate({ liveRate: 9, fixedRate: 900 })).toEqual({
      rate: 9,
      source: "live",
    });
  });

  it("uses fixed alone when live is unavailable", () => {
    expect(effectiveRate({ liveRate: null, fixedRate: 9.5 })).toEqual({
      rate: 9.5,
      source: "fixed",
    });
  });

  it("returns null when nothing is usable", () => {
    expect(effectiveRate({})).toBeNull();
    expect(effectiveRate({ liveRate: 0, fixedRate: "x" })).toBeNull();
    expect(effectiveRate({ liveRate: Number.NaN })).toBeNull();
  });
});

describe("convertTransfers", () => {
  it("rounds half-up to the currency's minor units (0 digits: JPY)", () => {
    // 5,000 / 9 = 555.55.. → 556
    const r = convertTransfers([{ from: "b", to: "a", krw: 5000 }], {
      currency: "jpy",
      rate: 9,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.currency).toBe("JPY");
    expect(r.items).toEqual([
      { from: "b", to: "a", krw: 5000, amount: 556, currency: "JPY" },
    ]);
    expect(r.total).toBe(556);
  });

  it("uses 2 decimals for USD and rounds .5 up", () => {
    // 1,000 / 4 = 250 ; 1,003 / 400 = 2.5075 → 2.51 ; 1,001 / 400 = 2.5025 → 2.5
    const r = convertTransfers(
      [
        { from: "b", to: "a", krw: 1003 },
        { from: "c", to: "a", krw: 1001 },
      ],
      { currency: "USD", rate: 400 }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items.map((i) => i.amount)).toEqual([2.51, 2.5]);
    expect(r.total).toBe(5.01);
  });

  it("rounds an exact half up (0.5 → 1) for 0-digit currencies", () => {
    expect(convertKrw(5, 10, "JPY")).toBe(1);
    expect(convertKrw(4, 10, "JPY")).toBe(0);
  });

  it("is reference-only: does not mutate input and keeps original krw", () => {
    const input = [{ from: "b", to: "a", krw: 7777 }];
    const snapshot = JSON.stringify(input);
    const r = convertTransfers(input, { currency: "USD", rate: 1380 });
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(r.ok && r.items[0]!.krw).toBe(7777);
  });

  it("per-item rounding may make the total differ slightly from converting the krw total", () => {
    const transfers = [
      { from: "b", to: "a", krw: 1 },
      { from: "c", to: "a", krw: 1 },
    ];
    const r = convertTransfers(transfers, { currency: "JPY", rate: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 1/3 → 0 each, total 0 although 2/3 → 1
    expect(r.total).toBe(0);
    expect(convertKrw(2, 3, "JPY")).toBe(1);
  });

  it("returns an empty conversion for no transfers", () => {
    const r = convertTransfers([], { currency: "USD", rate: 1300 });
    expect(r).toEqual({
      ok: true,
      currency: "USD",
      rate: 1300,
      items: [],
      total: 0,
    });
  });

  it("rejects bad currency and bad rates", () => {
    const t = [{ from: "b", to: "a", krw: 1000 }];
    expect(convertTransfers(t, { currency: "US", rate: 1 })).toEqual({
      ok: false,
      reason: "bad-currency",
    });
    expect(convertTransfers(t, { currency: "USD", rate: 0 })).toEqual({
      ok: false,
      reason: "bad-rate",
    });
    expect(convertTransfers(t, { currency: "USD", rate: Number.NaN })).toEqual({
      ok: false,
      reason: "bad-rate",
    });
  });
});

describe("format helpers", () => {
  it("formats the rate line", () => {
    expect(formatRateText("jpy", 9.12)).toBe("1 JPY = 9.12원");
    expect(formatRateText("USD", 1380)).toBe("1 USD = 1,380원");
  });

  it("formats converted amounts with minor units", () => {
    expect(formatConvertedAmount(556, "JPY")).toBe("556 JPY");
    expect(formatConvertedAmount(2.5, "USD")).toBe("2.50 USD");
  });
});
