import { describe, expect, it } from "vitest";
import {
  DCC_PUBLIC_STAT_NOTE,
  DCC_PUBLIC_STAT_URL,
  detectDcc,
  detectDupCharge,
} from "@/lib/ledger/dcc";

describe("detectDcc", () => {
  it("Japan trip + overseas KRW → suspected (no pct)", () => {
    const r = detectDcc({
      tripLocalCurrency: "JPY",
      draftCurrency: "KRW",
      overseas: true,
      merchant: "LAWSON",
    });
    expect(r).toEqual({
      level: "suspected",
      markupPct: null,
      markupKrw: null,
    });
  });

  it("receipt JPY+KRW secondary → confirmed with markup", () => {
    const r = detectDcc({
      tripLocalCurrency: "JPY",
      draftCurrency: "JPY",
      foreignAmount: 1000,
      foreignCurrency: "JPY",
      marketRate: 9,
      receiptSecondary: [{ currency: "KRW", amount: 10000, label: "charged" }],
    });
    expect(r.level).toBe("confirmed");
    expect(r.markupKrw).toBe(1000); // 10000 - 9000
    expect(r.markupPct).toBeCloseTo(1000 / 9000);
  });

  it("domestic trip / domestic payment → none", () => {
    expect(
      detectDcc({
        tripLocalCurrency: "KRW",
        draftCurrency: "KRW",
        overseas: false,
      }).level
    ).toBe("none");
    expect(
      detectDcc({
        tripLocalCurrency: "JPY",
        draftCurrency: "JPY",
        overseas: true,
      }).level
    ).toBe("none");
  });
});

describe("detectDupCharge", () => {
  const base = {
    merchant: "LAWSON TOKYO",
    amount: 500,
    currency: "JPY",
    paidAtMs: Date.parse("2026-11-03T12:00:00+09:00"),
  };

  it("same merchant+amount within 5 min → true", () => {
    expect(
      detectDupCharge(
        { ...base, paidAtMs: base.paidAtMs + 5 * 60_000 },
        [base],
        10
      )
    ).toBe(true);
  });

  it("11 min apart → false", () => {
    expect(
      detectDupCharge(
        { ...base, paidAtMs: base.paidAtMs + 11 * 60_000 },
        [base],
        10
      )
    ).toBe(false);
  });

  it("exactResend excluded", () => {
    expect(
      detectDupCharge(
        { ...base, paidAtMs: base.paidAtMs + 60_000, exactResend: true },
        [base],
        10
      )
    ).toBe(false);
  });
});

describe("DCC_PUBLIC_STAT_NOTE", () => {
  it("includes 2020 and source URL constant", () => {
    expect(DCC_PUBLIC_STAT_NOTE).toContain("2020");
    expect(DCC_PUBLIC_STAT_URL).toContain("edaily.co.kr");
    expect(DCC_PUBLIC_STAT_NOTE).toContain("금융감독원");
  });
});
