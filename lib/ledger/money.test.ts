import { describe, expect, it } from "vitest";
import {
  computeKrw,
  minorUnits,
  rateFromCash,
  roundHalfUp,
} from "@/lib/ledger/money";

describe("minorUnits", () => {
  it("JPY/KRW/VND are 0, USD is 2", () => {
    expect(minorUnits("JPY")).toBe(0);
    expect(minorUnits("KRW")).toBe(0);
    expect(minorUnits("VND")).toBe(0);
    expect(minorUnits("USD")).toBe(2);
  });
});

describe("roundHalfUp", () => {
  it("rounds .5 up", () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(1.5)).toBe(2);
    expect(roundHalfUp(2.4)).toBe(2);
  });
});

describe("computeKrw", () => {
  it("JPY 45000 x 9.0 with fee 1.2%", () => {
    const r = computeKrw({ amount: 45000, fxRate: 9.0, feeRate: 0.012 });
    expect(r.krwBase).toBe(405000);
    expect(r.feeKrw).toBe(4860);
    expect(r.krwAmount).toBe(409860);
  });

  it("null feeRate means 0 fee", () => {
    const r = computeKrw({ amount: 45000, fxRate: 9.0, feeRate: null });
    expect(r.feeKrw).toBe(0);
    expect(r.krwAmount).toBe(405000);
  });

  it("includes flat fee", () => {
    const r = computeKrw({
      amount: 100,
      fxRate: 10,
      feeRate: 0,
      feeFlatKrw: 500,
    });
    expect(r.krwBase).toBe(1000);
    expect(r.feeKrw).toBe(500);
    expect(r.krwAmount).toBe(1500);
  });
});

describe("rateFromCash", () => {
  it("10000 JPY for 91000 KRW", () => {
    expect(rateFromCash(10000, 91000)).toBe(9.1);
  });
});
