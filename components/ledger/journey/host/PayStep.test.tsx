// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basisHash, type LedgerExpense } from "@/lib/ledger/settle";
import type { SettlementSnapshot } from "@/lib/ledger/supabase";

const fetchLatestSettlement = vi.fn();
const fetchSettlementHistory = vi.fn();
const listMembers = vi.fn();
const listExpenses = vi.fn();
const listVoidedExpenseIds = vi.fn();

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
  getBrowserSupabase: () => ({ rpc: vi.fn() }),
}));
vi.mock("@/lib/ledger/fx", () => ({
  getFxRateToKrw: vi.fn(),
}));
vi.mock("@/lib/ledger/supabase", () => ({
  fetchLatestSettlement: (...a: unknown[]) => fetchLatestSettlement(...a),
  fetchSettlementHistory: (...a: unknown[]) => fetchSettlementHistory(...a),
  listMembers: (...a: unknown[]) => listMembers(...a),
  listExpenses: (...a: unknown[]) => listExpenses(...a),
  listVoidedExpenseIds: (...a: unknown[]) => listVoidedExpenseIds(...a),
}));

import { PayStep } from "./PayStep";

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

const ledgerExpenses: LedgerExpense[] = [
  { id: "e1", paidBy: "a", krwAmount: 10000, shares: { a: 5000, b: 5000 } },
];

async function settlement(
  patch: Partial<SettlementSnapshot> = {}
): Promise<SettlementSnapshot> {
  return {
    id: "s1",
    version: 1,
    status: "open",
    origin: "manual",
    basisHash: await basisHash(ledgerExpenses),
    shareToken: "tok123",
    transfers: [{ id: "t1", from: "b", to: "a", krw: 5000, status: "pending" }],
    ...patch,
  };
}

beforeEach(() => {
  fetchSettlementHistory.mockResolvedValue([]);
  listMembers.mockResolvedValue(members);
  listExpenses.mockResolvedValue([expenseRow]);
  listVoidedExpenseIds.mockResolvedValue(new Set());
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PayStep", () => {
  it("정산이 없으면 빈 상태와 정산 이동을 보여 줘요", async () => {
    fetchLatestSettlement.mockResolvedValue({ ok: true, settlement: null });
    const onSettle = vi.fn();
    render(
      <PayStep tripId="trip-1" mode="journey" onSettle={onSettle} />
    );
    expect(await screen.findByText("먼저 정산을 계산해요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "정산하러 가기" }));
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it("송금 목록과 공유·완료 CTA 를 보여 줘요", async () => {
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement(),
    });
    render(<PayStep tripId="trip-1" mode="journey" />);
    expect(await screen.findByText(/지영 → 민수/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "송금을 챙겨요" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "정산 현황 공유하기" })
    ).toBeTruthy();
  });

  it("모두 송금되면 리캡 CTA 를 보여 줘요", async () => {
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement({
        status: "completed",
        transfers: [
          { id: "t1", from: "b", to: "a", krw: 5000, status: "paid" },
        ],
      }),
    });
    const onRecap = vi.fn();
    render(
      <PayStep tripId="trip-1" mode="journey" onRecap={onRecap} />
    );
    expect(await screen.findByText("정산 완료")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "리캡 보기" }));
    expect(onRecap).toHaveBeenCalledTimes(1);
  });

  it("page 모드에서는 이전 정산 영역을 인라인으로 보여 줘요", async () => {
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement({ id: "s2", version: 2, shareToken: "tokNEW" }),
    });
    fetchSettlementHistory.mockResolvedValue([
      {
        id: "s2",
        version: 2,
        status: "open",
        origin: "manual",
        shareToken: "tokNEW",
        createdAt: "2026-11-02T01:00:00Z",
      },
      {
        id: "s1",
        version: 1,
        status: "superseded",
        origin: "manual",
        shareToken: "tokOLD",
        createdAt: "2026-11-01T01:00:00Z",
      },
    ]);
    render(<PayStep tripId="trip-1" mode="page" />);
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "이전 정산" })).toBeTruthy()
    );
  });
});
