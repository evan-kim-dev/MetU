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
const replace = vi.fn();
const rpc = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/components/ledger/SplitChatRoom", () => ({
  SplitChatRoom: () => <div data-testid="split-chat-room">분담 대화</div>,
  toSplitChatMembers: (members: unknown) => members,
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
  getBrowserSupabase: () => ({
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return chain;
    },
  }),
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
  search = "";
  fetchLatestSettlement.mockResolvedValue({ ok: true, settlement: null });
  fetchSettlementHistory.mockResolvedValue([]);
  listMembers.mockResolvedValue(members);
  listExpenses.mockResolvedValue([expenseRow]);
  listVoidedExpenseIds.mockResolvedValue(new Set<string>());
  rpc.mockResolvedValue({ data: "s-new", error: null });
  push.mockReset();
  replace.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettleStep", () => {
  it("정산 요약 아래에 분담 대화를 바로 보여 줘요", async () => {
    render(<SettleStep tripId="trip-1" mode="page" />);
    expect(await screen.findByRole("region", { name: "정산 요약" })).toBeTruthy();
    expect(await screen.findByTestId("split-chat-room")).toBeTruthy();
    expect(screen.queryByText("한 줄로 바꾸기")).toBeNull();
  });

  it("journey 모드에서도 대화와 단계 제목을 써요", async () => {
    const onAdjust = vi.fn();
    render(
      <SettleStep tripId="trip-1" mode="journey" onAdjust={onAdjust} />
    );
    expect(
      await screen.findByRole("heading", { name: "이 금액으로 정산해요" })
    ).toBeTruthy();
    expect(await screen.findByTestId("split-chat-room")).toBeTruthy();
    expect(onAdjust).not.toHaveBeenCalled();
  });

  it("외화 지출이 있으면 통화별 합계를 보여 줘요", async () => {
    listExpenses.mockResolvedValue([
      { ...expenseRow, currency: "JPY", amount: 1000, fxRateToKrw: 9 },
    ]);
    render(<SettleStep tripId="trip-1" mode="page" />);
    expect(await screen.findByTestId("currency-totals")).toBeTruthy();
    expect(screen.getByText("통화별 지출")).toBeTruthy();
  });

  it("측정된 수수료 차이가 없으면 시장환율 블록을 숨겨요", async () => {
    render(<SettleStep tripId="trip-1" mode="page" />);
    expect(await screen.findByRole("region", { name: "정산 요약" })).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "시장환율 대비 차이" })
    ).toBeNull();
  });

  it("청구액이 있으면 정산 요약 안에 시장환율 차이를 넣어요", async () => {
    listExpenses.mockResolvedValue([
      {
        ...expenseRow,
        currency: "JPY",
        amount: 1000,
        fxRateToKrw: 9,
        krwBase: 9000,
        billedKrw: 10000,
      },
    ]);
    render(<SettleStep tripId="trip-1" mode="page" />);
    expect(await screen.findByRole("region", { name: "정산 요약" })).toBeTruthy();
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
