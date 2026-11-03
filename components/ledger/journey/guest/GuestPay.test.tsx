// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchLatestSettlement = vi.fn();
const fetchSettlementHistory = vi.fn();
const listMembers = vi.fn();
const listExpenses = vi.fn();
const listVoidedExpenseIds = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u-b", is_anonymous: true },
    isAnonymous: true,
  }),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({}),
}));
vi.mock("@/lib/ledger/fx", () => ({ getFxRateToKrw: vi.fn() }));
vi.mock("@/lib/ledger/supabase", () => ({
  fetchLatestSettlement: (...a: unknown[]) => fetchLatestSettlement(...a),
  fetchSettlementHistory: (...a: unknown[]) => fetchSettlementHistory(...a),
  listMembers: (...a: unknown[]) => listMembers(...a),
  listExpenses: (...a: unknown[]) => listExpenses(...a),
  listVoidedExpenseIds: (...a: unknown[]) => listVoidedExpenseIds(...a),
}));

import { GuestPay } from "./GuestPay";

beforeEach(() => {
  fetchLatestSettlement.mockResolvedValue({ ok: true, settlement: null });
  fetchSettlementHistory.mockResolvedValue([]);
  listMembers.mockResolvedValue([
    {
      id: "b",
      tripId: "t1",
      displayName: "지영",
      isOwner: false,
      userId: "u-b",
    },
  ]);
  listExpenses.mockResolvedValue([]);
  listVoidedExpenseIds.mockResolvedValue(new Set());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GuestPay", () => {
  it("정산이 없으면 게스트용 빈 상태를 보여 줘요", async () => {
    render(<GuestPay tripId="t1" hasTransfers={false} />);
    expect(await screen.findByText("먼저 정산을 계산해요")).toBeTruthy();
    expect(
      screen.getByText(/호스트가 정산을 만들면 내가 보낼 금액/)
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "정산하러 가기" })).toBeNull();
  });
});
