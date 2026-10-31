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
import { basisHash, type LedgerExpense } from "@/lib/ledger/settle";
import type { SettlementSnapshot } from "@/lib/ledger/supabase";

const fetchLatestSettlement = vi.fn();
const fetchSettlementHistory = vi.fn();
const listMembers = vi.fn();
const listExpenses = vi.fn();
const listVoidedExpenseIds = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "trip-1" }),
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
  useAuth: () => ({ user: { id: "u-a" } }),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({}),
}));
vi.mock("@/lib/ledger/supabase", () => ({
  fetchLatestSettlement: (...a: unknown[]) => fetchLatestSettlement(...a),
  fetchSettlementHistory: (...a: unknown[]) => fetchSettlementHistory(...a),
  listMembers: (...a: unknown[]) => listMembers(...a),
  listExpenses: (...a: unknown[]) => listExpenses(...a),
  listVoidedExpenseIds: (...a: unknown[]) => listVoidedExpenseIds(...a),
}));

import LedgerSettlePage from "@/app/trips/[id]/ledger/settle/page";

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

const writeText = vi.fn();

beforeEach(() => {
  fetchSettlementHistory.mockResolvedValue([]);
  listMembers.mockResolvedValue(members);
  listExpenses.mockResolvedValue([expenseRow]);
  listVoidedExpenseIds.mockResolvedValue(new Set<string>());
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  Object.defineProperty(navigator, "share", {
    value: undefined,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LedgerSettlePage", () => {
  it("restores an existing (auto) settlement on mount without recomputing", async () => {
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement({ origin: "auto" }),
    });
    render(<LedgerSettlePage />);

    expect(await screen.findByText(/지영 → 민수/)).toBeTruthy();
    expect(screen.getByText(/자동으로 만든 정산 제안/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "정산 다시 계산하기" })).toBeTruthy();
    expect(screen.queryByText(/정산 후 지출이 바뀌었어요/)).toBeNull();
    expect(fetchLatestSettlement).toHaveBeenCalledTimes(1);
  });

  it("highlights own row and shows signed balances", async () => {
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement(),
    });
    render(<LedgerSettlePage />);
    await screen.findByText(/지영 → 민수/);

    const mine = screen.getByTestId("balance-a");
    expect(mine.getAttribute("data-mine")).toBe("true");
    expect(mine.textContent).toContain("+₩5,000");
    const other = screen.getByTestId("balance-b");
    expect(other.getAttribute("data-mine")).toBeNull();
    expect(other.textContent).toContain("-₩5,000");
  });

  it("copies share text and link; hides native share when unsupported", async () => {
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement(),
    });
    render(<LedgerSettlePage />);
    await screen.findByText(/지영 → 민수/);

    expect(screen.queryByRole("button", { name: "공유하기" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "문구 복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = String(writeText.mock.calls[0]![0]);
    expect(text).toContain("지영 → 민수 ₩5,000");
    expect(text).toContain("/s/tok123");

    fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(String(writeText.mock.calls[1]![0])).toMatch(/\/s\/tok123$/);
  });

  it("shows stale hint and blocks share text when expenses changed", async () => {
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement({ basisHash: "old-hash" }),
    });
    render(<LedgerSettlePage />);

    expect(await screen.findByText(/정산 후 지출이 바뀌었어요/)).toBeTruthy();
    const copyBtn = screen.getByRole("button", {
      name: "문구 복사",
    }) as HTMLButtonElement;
    expect(copyBtn.disabled).toBe(true);
  });

  it("shows 정산 완료 when every transfer is paid", async () => {
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement({
        status: "completed",
        transfers: [
          { id: "t1", from: "b", to: "a", krw: 5000, status: "paid" },
        ],
      }),
    });
    render(<LedgerSettlePage />);
    expect(await screen.findByText("정산 완료")).toBeTruthy();
  });

  it("excludes voided expenses from balances", async () => {
    listVoidedExpenseIds.mockResolvedValue(new Set(["e1"]));
    fetchLatestSettlement.mockResolvedValue({ ok: true, settlement: null });
    render(<LedgerSettlePage />);
    await screen.findByText(/아직 만든 정산표가 없어요/);
    expect(screen.getByTestId("balance-a").textContent).toContain("₩0");
  });

  it("warns (without blocking) when fx fallback rates are used", async () => {
    listExpenses.mockResolvedValue([
      { ...expenseRow, currency: "JPY", fxIsFallback: true },
    ]);
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement(),
    });
    render(<LedgerSettlePage />);
    expect(
      await screen.findByText(/1건은 마지막으로 확인한 환율로 계산됐어요/)
    ).toBeTruthy();
    expect(screen.getByText("ExchangeRate-API")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "문구 복사" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
});

describe("LedgerSettlePage — 이전 정산(공유 이력)", () => {
  it("이전 버전의 /s 링크를 목록으로 보여주고 복사한다 (현재 버전은 제외)", async () => {
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
    render(<LedgerSettlePage />);

    const section = await screen.findByRole("region", { name: "이전 정산" });
    expect(section.textContent).toContain("v1");
    expect(section.textContent).toContain("최신 아님");
    expect(section.textContent).not.toContain("v2");

    fireEvent.click(screen.getByRole("button", { name: "v1 공유 링크 복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(String(writeText.mock.calls[0]![0])).toMatch(/\/s\/tokOLD$/);
    expect(
      screen.getByRole("link", { name: "v1 정산 열기" }).getAttribute("href")
    ).toBe("/s/tokOLD");
  });

  it("이전 버전이 없으면 이전 정산 영역을 그리지 않는다", async () => {
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement(),
    });
    render(<LedgerSettlePage />);
    await screen.findByText(/지영 → 민수/);
    expect(screen.queryByRole("region", { name: "이전 정산" })).toBeNull();
  });

  it("소유자가 아니면 정산 계산 버튼이 없고 안내만 보인다", async () => {
    listMembers.mockResolvedValue([
      { ...members[0], userId: "u-other" },
      { ...members[1], userId: "u-a", isOwner: false },
    ]);
    fetchLatestSettlement.mockResolvedValue({
      ok: true,
      settlement: await settlement(),
    });
    render(<LedgerSettlePage />);
    await screen.findByText(/지영 → 민수/);
    expect(screen.queryByRole("button", { name: "정산 계산하기" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "정산 다시 계산하기" })
    ).toBeNull();
    expect(screen.getByText(/여행을 만든 분만 만들 수 있어요/)).toBeTruthy();
  });
});
