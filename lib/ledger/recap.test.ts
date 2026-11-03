import { describe, expect, it } from "vitest";

import {
  assertRecapCopyNumbers,
  buildTripRecap,
  templateRecapCopy,
} from "./recap";
import type { LedgerExpenseRow, TripMember } from "./types";

const members: TripMember[] = [
  {
    id: "a",
    tripId: "t1",
    displayName: "민수",
    isOwner: true,
    userId: "u-a",
  },
  {
    id: "b",
    tripId: "t1",
    displayName: "지영",
    isOwner: false,
    userId: "u-b",
  },
];

function exp(
  over: Partial<LedgerExpenseRow> & Pick<LedgerExpenseRow, "id" | "krwAmount">
): LedgerExpenseRow {
  return {
    tripId: "t1",
    paidBy: "a",
    label: "x",
    category: "식비",
    amount: over.krwAmount,
    currency: "KRW",
    fxRateToKrw: 1,
    splitType: "equal",
    shares: { a: Math.floor(over.krwAmount / 2), b: Math.ceil(over.krwAmount / 2) },
    spentOn: "2026-11-01",
    source: "manual",
    ...over,
  };
}

describe("buildTripRecap", () => {
  it("zero expenses: only totals", () => {
    const r = buildTripRecap({ members, expenses: [] });
    expect(r).toEqual({ totalKrw: 0, perMemberOwed: [] });
    expect(r).not.toHaveProperty("topDay");
    expect(r).not.toHaveProperty("feeLeak");
  });

  it("shares sum equals total", () => {
    const expenses = [
      exp({ id: "1", krwAmount: 10000 }),
      exp({ id: "2", krwAmount: 4000, category: "교통", spentOn: "2026-11-02" }),
    ];
    const r = buildTripRecap({ members, expenses });
    expect(r.totalKrw).toBe(14000);
    const owedSum = r.perMemberOwed.reduce((s, m) => s + m.krw, 0);
    expect(owedSum).toBe(14000);
  });

  it("topDay tie breaks by date ascending", () => {
    const expenses = [
      exp({ id: "1", krwAmount: 5000, spentOn: "2026-11-02" }),
      exp({ id: "2", krwAmount: 5000, spentOn: "2026-11-01" }),
    ];
    const r = buildTripRecap({ members, expenses });
    expect(r.topDay).toEqual({ date: "2026-11-01", krw: 5000 });
  });

  it("omits feeLeak when no measured billed", () => {
    const r = buildTripRecap({
      members,
      expenses: [exp({ id: "1", krwAmount: 1000 })],
    });
    expect(r.feeLeak).toBeUndefined();
  });

  it("includes feeLeak when billed measured", () => {
    const r = buildTripRecap({
      members,
      expenses: [
        exp({
          id: "1",
          krwAmount: 11000,
          krwBase: 10000,
          billedKrw: 11000,
          currency: "JPY",
        }),
      ],
    });
    expect(r.feeLeak).toEqual({ measuredKrw: 1000, measuredCount: 1 });
  });
});

describe("assertRecapCopyNumbers", () => {
  it("rejects invented percent", () => {
    expect(assertRecapCopyNumbers("12% 절약했어요", [10000, 5000])).toBe(false);
  });

  it("accepts known totals", () => {
    expect(
      assertRecapCopyNumbers(templateRecapCopy({
        totalKrw: 10000,
        perMemberOwed: [],
        topCategory: { category: "식비", krw: 7000 },
      }), [10000, 7000])
    ).toBe(true);
  });
});
