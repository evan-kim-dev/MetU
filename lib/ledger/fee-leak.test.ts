import { describe, expect, it } from "vitest";
import {
  FEE_LEAK_EMPTY_COPY,
  computeFeeLeak,
  feeLeakMeasuredCopy,
  feeLeakMoreSpentCopy,
} from "@/lib/ledger/fee-leak";
import type { LedgerExpenseRow } from "@/lib/ledger/types";

function exp(
  over: Record<string, unknown> = {}
): LedgerExpenseRow {
  return {
    id: "e1",
    tripId: "t1",
    paidBy: "m1",
    label: "x",
    category: "기타",
    amount: 1000,
    currency: "JPY",
    fxRateToKrw: 9,
    krwAmount: 9000,
    splitType: "equal",
    shares: {},
    ...over,
  } as LedgerExpenseRow;
}

describe("computeFeeLeak", () => {
  it("측정 0건 → measuredKrw null", () => {
    const r = computeFeeLeak([exp({ feeKrw: 0 })]);
    expect(r.measuredKrw).toBeNull();
    expect(r.measuredCount).toBe(0);
  });

  it("양수·음수 혼합 합계", () => {
    const r = computeFeeLeak([
      exp({ id: "a", billedKrw: 11000, krwBase: 10000 }),
      exp({ id: "b", billedKrw: 9000, krwBase: 10000 }),
    ]);
    expect(r.measuredCount).toBe(2);
    expect(r.measuredKrw).toBe(0);
  });

  it("voided 제외", () => {
    const r = computeFeeLeak([
      exp({
        id: "v",
        status: "voided",
        billedKrw: 12000,
        krwBase: 10000,
      }),
    ]);
    expect(r.measuredCount).toBe(0);
    expect(r.measuredKrw).toBeNull();
  });

  it("estimated와 measured 분리", () => {
    const r = computeFeeLeak([
      exp({
        id: "m",
        billedKrw: 10500,
        krwBase: 10000,
        feeKrw: 999,
      }),
      exp({ id: "e", feeKrw: 300, krwBase: 10000 }),
    ]);
    expect(r.measuredKrw).toBe(500);
    expect(r.measuredCount).toBe(1);
    expect(r.estimatedKrw).toBe(300);
    expect(r.estimatedCount).toBe(1);
  });

  it("DCC confirmed만 dccKnown", () => {
    const r = computeFeeLeak([
      exp({
        id: "d",
        flags: {
          dcc: { level: "confirmed", markupPct: 0.05, markupKrw: 700 },
        },
      }),
      exp({
        id: "s",
        flags: {
          dcc: { level: "suspected", markupPct: null, markupKrw: null },
        },
      }),
    ]);
    expect(r.dccCount).toBe(1);
    expect(r.dccKnownKrw).toBe(700);
  });
});

describe("fee leak copy", () => {
  it("빈 측정 문구에 수수료 단정 없음", () => {
    expect(FEE_LEAK_EMPTY_COPY.includes("수수료")).toBe(false);
    expect(feeLeakMeasuredCopy(1200, 2)).toMatch(/시장환율/);
    expect(feeLeakMoreSpentCopy(1200)).toMatch(/더 나갔어요/);
    expect(feeLeakMoreSpentCopy(-100)).toBeNull();
    expect(feeLeakMoreSpentCopy(0)).toBeNull();
  });
});
