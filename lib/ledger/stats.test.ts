import { describe, expect, it } from "vitest";
import {
  byCategory,
  byDay,
  computeLedgerStats,
  dailyRecommended,
  remainingBudget,
  totalKrw,
  totalsByCurrency,
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

describe("totalsByCurrency", () => {
  const expenses = [
    exp({ id: "1", krwAmount: 410400, amount: 45000, currency: "JPY", fxRateToKrw: 9.12 }),
    exp({ id: "2", krwAmount: 9120, amount: 1000, currency: "jpy", fxRateToKrw: 9.12 }),
    exp({ id: "3", krwAmount: 17250, amount: 12.5, currency: "USD", fxRateToKrw: 1380 }),
    exp({ id: "4", krwAmount: 17250, amount: 12.5, currency: "USD", fxRateToKrw: 1380 }),
    exp({ id: "5", krwAmount: 8000, amount: 8000, currency: "KRW" }),
  ];

  it("통화별로 묶고 원화 합 내림차순 정렬", () => {
    const t = totalsByCurrency(expenses);
    expect(t.map((x) => x.currency)).toEqual(["JPY", "USD", "KRW"]);
    expect(t[0]).toEqual({ currency: "JPY", amount: 46000, krw: 419520, count: 2 });
    expect(t[1]).toEqual({ currency: "USD", amount: 25, krw: 34500, count: 2 });
    expect(t[2]).toEqual({ currency: "KRW", amount: 8000, krw: 8000, count: 1 });
  });

  it("KRW 합은 기존 totalKrw 와 일치", () => {
    const t = totalsByCurrency(expenses);
    expect(t.reduce((s, x) => s + x.krw, 0)).toBe(totalKrw(expenses));
    expect(computeLedgerStats({ expenses, budget: 0 }).totalsByCurrency).toEqual(t);
  });

  it("부동소수 누적 오차를 통화 최소 단위로 정리", () => {
    const t = totalsByCurrency([
      exp({ id: "a", krwAmount: 100, amount: 0.1, currency: "USD" }),
      exp({ id: "b", krwAmount: 200, amount: 0.2, currency: "USD" }),
    ]);
    expect(t[0]!.amount).toBe(0.3);
  });

  it("빈 목록", () => {
    expect(totalsByCurrency([])).toEqual([]);
  });
});
