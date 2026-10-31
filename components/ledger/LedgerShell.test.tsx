// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExpenseDraftInput } from "@/lib/ledger/draft";

let search = "";
const useAuth = vi.fn();
const listMembers = vi.fn();
const listExpenses = vi.fn();
const listCardProfiles = vi.fn();
const ensureOwnerMember = vi.fn();
const getBrowserSupabase = vi.fn();
const confirmSheet = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/auth/AuthProvider", () => ({ useAuth: () => useAuth() }));
vi.mock("@/lib/ledger/supabase", () => ({
  listMembers: (...a: unknown[]) => listMembers(...a),
  listExpenses: (...a: unknown[]) => listExpenses(...a),
  listCardProfiles: (...a: unknown[]) => listCardProfiles(...a),
  ensureOwnerMember: (...a: unknown[]) => ensureOwnerMember(...a),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => getBrowserSupabase(),
}));
vi.mock("@/components/ledger/ExpenseConfirmSheet", () => ({
  ExpenseConfirmSheet: (props: { drafts: ExpenseDraftInput[] }) => {
    confirmSheet(props);
    return <div data-testid="confirm-sheet" />;
  },
}));
vi.mock("@/components/ledger/LedgerDashboard", () => ({
  LedgerDashboard: () => null,
}));
vi.mock("@/components/ledger/PasteExpenseBox", () => ({
  PasteExpenseBox: () => <button type="button">붙여넣기 분석</button>,
}));
vi.mock("@/components/ledger/ReceiptUploader", () => ({
  ReceiptUploader: () => <button type="button">영수증 촬영하기</button>,
}));
vi.mock("@/components/ledger/VoiceInputButton", () => ({
  VoiceInputButton: () => <button type="button">음성 입력</button>,
}));
vi.mock("@/components/ledger/CardProfileSettings", () => ({
  CardProfileSettings: () => <button type="button">카드 수수료 추가</button>,
}));
vi.mock("@/components/ledger/CashRateSettings", () => ({
  CashRateSettings: () => <button type="button">현금 환율 저장</button>,
}));
vi.mock("@/components/trips/ledger/TripInvitePanel", () => ({
  TripInvitePanel: () => null,
}));

import { LedgerShell } from "@/components/ledger/LedgerShell";

const scrollIntoView = vi.fn();

beforeEach(() => {
  search = "";
  useAuth.mockReturnValue({ user: { id: "u1", user_metadata: {} }, provider: "kakao" });
  listMembers.mockResolvedValue([
    { id: "m1", tripId: "t1", displayName: "가나", isOwner: true, userId: "u1" },
  ]);
  listExpenses.mockResolvedValue([]);
  listCardProfiles.mockResolvedValue([]);
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => Promise.resolve({ count: 0, error: null }),
  };
  getBrowserSupabase.mockReturnValue({ from: () => chain });
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function loaded() {
  await screen.findByText("지출 목록");
}

describe("LedgerShell 바로가기 쿼리", () => {
  it("쿼리가 없으면 기존 동작 그대로예요 (시트·스크롤·포커스 없음)", async () => {
    render(<LedgerShell tripId="t1" />);
    await loaded();
    expect(screen.queryByTestId("confirm-sheet")).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it("?add=manual 이면 확인 시트가 기존 직접 입력 초안으로 바로 열려요", async () => {
    search = "add=manual";
    render(<LedgerShell tripId="t1" />);
    expect(await screen.findByTestId("confirm-sheet")).toBeTruthy();
    const props = confirmSheet.mock.calls.at(-1)![0] as { drafts: ExpenseDraftInput[] };
    expect(props.drafts).toHaveLength(1);
    expect(props.drafts[0]).toMatchObject({
      source: "manual",
      origin: "manual",
      merchant: "",
      amount: null,
      currency: "KRW",
      category: "기타",
    });
  });

  it("?add=receipt 는 영수증 섹션으로 스크롤하고 첫 버튼에 포커스만 줘요", async () => {
    search = "add=receipt";
    render(<LedgerShell tripId="t1" />);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText("영수증 촬영하기"))
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("confirm-sheet")).toBeNull();
  });

  it("?add=voice 는 음성 섹션으로 이동해요", async () => {
    search = "add=voice";
    render(<LedgerShell tripId="t1" />);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText("음성 입력"))
    );
    expect(screen.queryByTestId("confirm-sheet")).toBeNull();
  });

  it("?settings=fx 는 환율·수수료 설정으로 이동해요", async () => {
    search = "settings=fx";
    render(<LedgerShell tripId="t1" />);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText("카드 수수료 추가"))
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("알 수 없는 값은 무시해요", async () => {
    search = "add=hack&settings=other";
    render(<LedgerShell tripId="t1" />);
    await loaded();
    expect(screen.queryByTestId("confirm-sheet")).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
