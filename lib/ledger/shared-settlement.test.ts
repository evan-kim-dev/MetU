import { describe, expect, it } from "vitest";

import {
  checkExpenseSum,
  parseSharedSettlementDetail,
} from "@/lib/ledger/shared-settlement";

function raw(over: Record<string, unknown> = {}) {
  return {
    destination: "도쿄",
    dateRange: "2026-07-20 · 3박 4일",
    version: 2,
    status: "open",
    completedAt: null,
    settledAt: "2026-07-24T01:00:00Z",
    members: [
      { id: "m1", displayName: "민수" },
      { id: "m2", displayName: "지영" },
    ],
    transfers: [{ from: "m2", to: "m1", krw: 5000, status: "pending" }],
    totals: { totalKrw: 15000, expenseCount: 2, expensesTruncated: false },
    expenses: [
      {
        id: "e1",
        label: "점심",
        category: "식비",
        spentOn: "2026-07-21",
        paidBy: "m1",
        amount: 10000,
        currency: "KRW",
        fxRateToKrw: 1,
        krwAmount: 10000,
      },
      {
        id: "e2",
        label: "라멘",
        category: "식비",
        spentOn: "2026-07-22",
        paidBy: "m2",
        amount: 500,
        currency: "JPY",
        fxRateToKrw: 10,
        krwAmount: 5000,
      },
    ],
    ...over,
  };
}

describe("parseSharedSettlementDetail", () => {
  it("정상 응답을 앱 타입으로 바꾼다", () => {
    const d = parseSharedSettlementDetail(raw());
    expect(d?.destination).toBe("도쿄");
    expect(d?.expenses).toHaveLength(2);
    expect(d?.expenses[1]).toMatchObject({
      currency: "JPY",
      fxRateToKrw: 10,
      krwAmount: 5000,
    });
    expect(d?.totals).toEqual({
      totalKrw: 15000,
      expenseCount: 2,
      expensesTruncated: false,
    });
  });

  it("문자열로 온 숫자(numeric)도 숫자로 읽는다", () => {
    const d = parseSharedSettlementDetail(
      raw({
        expenses: [
          {
            id: "e1",
            label: "x",
            paidBy: "m1",
            amount: "10000.00",
            currency: "KRW",
            fxRateToKrw: "1.000000",
            krwAmount: "10000",
          },
        ],
        totals: { totalKrw: "10000" },
      })
    );
    expect(d?.expenses[0]?.amount).toBe(10000);
    expect(d?.totals.totalKrw).toBe(10000);
    expect(d?.totals.expenseCount).toBe(1);
  });

  it("알 수 없는 필드(개인정보 포함 가능)는 버린다", () => {
    const d = parseSharedSettlementDetail(
      raw({
        members: [{ id: "m1", displayName: "민수", user_id: "u", email: "a@b.c" }],
      })
    );
    expect(d?.members[0]).toEqual({ id: "m1", displayName: "민수" });
  });

  it("형식이 틀리거나 null 이면 null", () => {
    expect(parseSharedSettlementDetail(null)).toBeNull();
    expect(parseSharedSettlementDetail({ destination: "x" })).toBeNull();
    expect(parseSharedSettlementDetail(raw({ expenses: "nope" }))).toBeNull();
  });
});

describe("checkExpenseSum", () => {
  it("합계가 총액과 같으면 match", () => {
    const d = parseSharedSettlementDetail(raw())!;
    expect(checkExpenseSum(d)).toEqual({ kind: "match", sumKrw: 15000 });
  });

  it("합계가 다르면 mismatch", () => {
    const d = parseSharedSettlementDetail(
      raw({ totals: { totalKrw: 16000, expenseCount: 2 } })
    )!;
    expect(checkExpenseSum(d)).toEqual({
      kind: "mismatch",
      sumKrw: 15000,
      totalKrw: 16000,
    });
  });

  it("일부만 내려오면 partial (대조하지 않는다)", () => {
    const d = parseSharedSettlementDetail(
      raw({ totals: { totalKrw: 99999, expenseCount: 250, expensesTruncated: true } })
    )!;
    expect(checkExpenseSum(d)).toEqual({ kind: "partial", shown: 2, total: 250 });
  });
});
