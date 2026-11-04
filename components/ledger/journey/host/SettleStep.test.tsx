// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchLatestSettlement = vi.fn();
const fetchSettlementHistory = vi.fn();
const listMembers = vi.fn();
const listExpenses = vi.fn();
const listVoidedExpenseIds = vi.fn();
const push = vi.fn();
const rpc = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u-a" }, isAnonymous: false }),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({ rpc: (...a: unknown[]) => rpc(...a) }),
}));
vi.mock("@/lib/ledger/fx", () => ({
  getFxRateToKrw: vi.fn(),
}));
vi.mock("@/lib/ledger/settle", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/ledger/settle")>();
  return {
    ...actual,
    basisHash: vi.fn(async () => "test-basis"),
  };
});
vi.mock("@/lib/ledger/supabase", () => ({
  fetchLatestSettlement: (...a: unknown[]) => fetchLatestSettlement(...a),
  fetchSettlementHistory: (...a: unknown[]) => fetchSettlementHistory(...a),
  listMembers: (...a: unknown[]) => listMembers(...a),
  listExpenses: (...a: unknown[]) => listExpenses(...a),
  listVoidedExpenseIds: (...a: unknown[]) => listVoidedExpenseIds(...a),
}));

import { SettleStep } from "./SettleStep";

const members = [
  {
    id: "a",
    tripId: "trip-1",
    displayName: "민수",
    isOwner: true,
    userId: "u-a",
  },
  {
    id: "b",
    tripId: "trip-1",
    displayName: "지영",
    isOwner: false,
    userId: "u-b",
  },
];

const expenseRow = {
  id: "e1",
  tripId: "trip-1",
  paidBy: "a",
  label: "점심",
  category: "식비",
  amount: 10000,
  currency: "KRW",
  fxRateToKrw: 1,
  krwAmount: 10000,
  splitType: "equal" as const,
  shares: { a: 5000, b: 5000 },
};

const openSettlement = {
  id: "s1",
  tripId: "trip-1",
  version: 1,
  status: "open" as const,
  basisHash: "test-basis",
  shareToken: "tok",
  transfers: [
    {
      id: "t1",
      from: "b",
      to: "a",
      krw: 5000,
      status: "pending" as const,
    },
  ],
};

beforeEach(() => {
  fetchLatestSettlement.mockResolvedValue({ ok: true, settlement: null });
  fetchSettlementHistory.mockResolvedValue([]);
  listMembers.mockResolvedValue(members);
  listExpenses.mockResolvedValue([expenseRow]);
  listVoidedExpenseIds.mockResolvedValue(new Set<string>());
  rpc.mockResolvedValue({ data: "s-new", error: null });
  push.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettleStep", () => {
  it("SplitPatchBox 대신 「분담 수정하기」 링크를 보여 줘요", async () => {
    render(<SettleStep tripId="trip-1" mode="page" />);
    const link = await screen.findByRole("link", { name: "분담 수정하기" });
    expect(link.getAttribute("href")).toBe("/trips/trip-1/ledger?step=adjust");
    expect(screen.queryByText("한 줄로 바꾸기")).toBeNull();
  });

  it("journey 모드에서는 onAdjust 버튼과 단계 제목을 써요", async () => {
    const onAdjust = vi.fn();
    render(
      <SettleStep tripId="trip-1" mode="journey" onAdjust={onAdjust} />
    );
    expect(
      await screen.findByRole("heading", { name: "이 금액으로 정산해요" })
    ).toBeTruthy();
    const btn = screen.getByRole("button", { name: "분담 수정하기" });
    btn.click();
    expect(onAdjust).toHaveBeenCalledTimes(1);
  });

  it("외화 지출이 있으면 통화별 합계를 보여 줘요", async () => {
    listExpenses.mockResolvedValue([
      { ...expenseRow, currency: "JPY", amount: 1000, fxRateToKrw: 9 },
    ]);
    render(<SettleStep tripId="trip-1" mode="page" />);
    expect(await screen.findByTestId("currency-totals")).toBeTruthy();
    expect(screen.getByText("통화별 지출")).toBeTruthy();
  });

  it("시장환율 대비 차이 카드를 보여 줘요", async () => {
    render(<SettleStep tripId="trip-1" mode="page" />);
    expect(
      await screen.findByRole("region", { name: "시장환율 대비 차이" })
    ).toBeTruthy();
  });

  it("정산표가 있으면 주 CTA 가 송금하러 가기예요", async () => {
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: openSettlement,
    });
    const onPay = vi.fn();
    render(<SettleStep tripId="trip-1" mode="journey" onPay={onPay} />);
    const cta = await screen.findByRole("button", { name: "송금하러 가기" });
    expect(
      screen.getByRole("button", { name: "정산 다시 계산하기" })
    ).toBeTruthy();
    fireEvent.click(cta);
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it("정산 계산 성공 후 송금 단계로 넘어가요", async () => {
    fetchLatestSettlement
      .mockResolvedValueOnce({ ok: true, settlement: null })
      .mockResolvedValueOnce({
        ok: true,
        settlement: openSettlement,
      });
    const onPay = vi.fn();
    render(<SettleStep tripId="trip-1" mode="journey" onPay={onPay} />);
    const calc = await screen.findByRole("button", { name: "정산 계산하기" });
    fireEvent.click(calc);
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    await waitFor(() => expect(onPay).toHaveBeenCalledTimes(1));
  });
});
