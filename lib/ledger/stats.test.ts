import { describe, expect, it } from "vitest";
import {
  byCategory,
  byDay,
  computeLedgerStats,
  dailyRecommended,
  remainingBudget,
  totalKrw,
} from "@/lib/ledger/stats";
import type { LedgerExpenseRow } from "@/lib/ledger/types";

function exp(
  partial: Partial<LedgerExpenseRow> & { id: string; krwAmount: number }
): LedgerExpenseRow {
  return {
    tripId: "t",
    paidBy: "a",
    label: "x",
    category: "식비",
    amount: 1,
    currency: "KRW",
    fxRateToKrw: 1,
    splitType: "equal",
    shares: { a: partial.krwAmount },
    ...partial,
  };
}

describe("ledger stats", () => {
  it("sums and partitions equal", () => {
    const expenses = [
      exp({ id: "1", krwAmount: 3000, spentOn: "2026-11-01", category: "식비" }),
      exp({ id: "2", krwAmount: 7000, spentOn: "2026-11-02", category: "교통" }),
    ];
    expect(totalKrw(expenses)).toBe(10000);
    expect(byDay(expenses)["2026-11-01"]).toBe(3000);
    expect(byCategory(expenses)["식비"]).toBe(3000);
    expect(
      Object.values(byDay(expenses)).reduce((a, b) => a + b, 0)
    ).toBe(totalKrw(expenses));
  });

  it("remaining and daily recommended", () => {
    expect(remainingBudget(100000, 40000)).toBe(60000);
    expect(
      dailyRecommended({
        remaining: 60000,
        today: "2026-11-01",
        endDate: "2026-11-03",
      })
    ).toBe(20000);
    expect(
      dailyRecommended({
        remaining: -1000,
        today: "2026-11-01",
        endDate: "2026-11-03",
      })
    ).toBe(0);
    expect(
      dailyRecommended({
        remaining: 1000,
        today: "2026-11-10",
        endDate: "2026-11-03",
      })
    ).toBeNull();
  });

  it("empty expenses", () => {
    const s = computeLedgerStats({
      expenses: [],
      budget: 50000,
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      today: "2026-11-01",
    });
    expect(s.totalKrw).toBe(0);
    expect(s.remainingBudget).toBe(50000);
  });
});
