// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/trips/ledger/MemberManager", () => ({
  MemberManager: () => null,
}));
vi.mock("@/components/trips/ledger/ExpenseForm", () => ({
  ExpenseForm: () => null,
}));
vi.mock("@/components/trips/ledger/NaturalExpenseInput", () => ({
  NaturalExpenseInput: () => null,
}));

import { LedgerTab } from "@/components/trips/ledger/LedgerTab";
import type { LedgerExpenseRow } from "@/lib/ledger/types";

afterEach(cleanup);

function exp(p: Partial<LedgerExpenseRow> & { id: string }): LedgerExpenseRow {
  return {
    tripId: "t",
    paidBy: "m1",
    label: "라멘",
    category: "식비",
    amount: 45000,
    currency: "JPY",
    fxRateToKrw: 9.12,
    fxRateDate: "2026-11-03",
    fxSource: "auto_daily",
    fxIsFallback: false,
    krwAmount: 410400,
    splitType: "equal",
    shares: {},
    ...p,
  };
}

function renderTab(expenses: LedgerExpenseRow[]) {
  return render(
    <LedgerTab
      readOnly
      members={[]}
      expenses={expenses}
      totalKrw={expenses.reduce((s, e) => s + e.krwAmount, 0)}
      defaultCurrency="KRW"
      placeOptions={[]}
      settlement={{ balances: {}, transfers: [] }}
    />
  );
}

describe("LedgerTab FX 표기", () => {
  it("외화 지출에 환율 줄과 aria-label 을 보여줘요", () => {
    renderTab([exp({ id: "1" })]);
    expect(
      screen.getByText("45,000 JPY · 1 JPY = 9.12원 · 11/03 기준")
    ).toBeTruthy();
    const btn = screen.getByRole("button", { name: /환율 1 JPY = 9\.12원/ });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("일별 환율 자동 조회")).toBeTruthy();
    expect(screen.queryByText("마지막 확인 환율")).toBeNull();
  });

  it("fallback 이면 주황 배지와 정산 전 확인 안내를 보여줘요", () => {
    renderTab([exp({ id: "1", fxIsFallback: true })]);
    // 배지 1개 + (접힌) 상세의 출처 항목 1개
    expect(screen.getAllByText("마지막 확인 환율").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/정산하기 전에/)).toBeTruthy();
  });

  it("KRW 지출만 있으면 환율 줄, 통화별 합계, 출처 표기가 없어요", () => {
    renderTab([
      exp({
        id: "1",
        currency: "KRW",
        amount: 9000,
        fxRateToKrw: 1,
        krwAmount: 9000,
      }),
    ]);
    expect(screen.queryByText(/기준$/)).toBeNull();
    expect(screen.queryByTestId("currency-totals")).toBeNull();
    expect(screen.queryByText(/ExchangeRate-API/)).toBeNull();
  });

  it("통화별 합계와 출처 표기는 한 번만 보여줘요", () => {
    renderTab([
      exp({ id: "1" }),
      exp({ id: "2", amount: 1000, krwAmount: 9120 }),
    ]);
    expect(screen.getAllByText(/ExchangeRate-API/)).toHaveLength(1);
    expect(screen.getByTestId("currency-totals").textContent).toContain(
      "46,000 JPY"
    );
  });
});
