// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
  fetchLatestSettlement: vi.fn(async () => ({ ok: true, settlement: null })),
  fetchSettlementHistory: vi.fn(async () => []),
  listVoidedExpenseIds: vi.fn(async () => new Set()),
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
vi.mock("@/components/ledger/HostPayoutSettings", () => ({
  HostPayoutSettings: () => <button type="button">입금 계좌 저장</button>,
}));
vi.mock("@/components/ledger/HostTransferSettings", () => ({
  HostTransferSettings: () => <button type="button">호스트 넘기기</button>,
}));
vi.mock("@/components/ledger/CashRateSettings", () => ({
  CashRateSettings: () => <button type="button">현금 환율 저장</button>,
}));
vi.mock("@/components/trips/ledger/TripInvitePanel", () => ({
  TripInvitePanel: () => null,
}));

import { ToastProvider } from "@/components/ds/Toast";
import { LedgerShell } from "@/components/ledger/LedgerShell";

const scrollIntoView = vi.fn();

beforeEach(() => {
  search = "";
  useAuth.mockReturnValue({
    user: { id: "u1", user_metadata: {} },
    provider: "kakao",
    isAnonymous: false,
  });
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

/** 호스트 기록 단계는 "최근 지출", 게스트 읽기 전용은 "지출 목록" 이 보이면 로드 끝. */
async function loaded() {
  await screen.findByText(/^(최근 지출|지출 목록)$/);
}

describe("LedgerShell 바로가기 쿼리", () => {
  it("쿼리가 없으면 기존 동작 그대로예요 (시트·스크롤·포커스 없음)", async () => {
    render(<LedgerShell tripId="t1" />);
    await loaded();
    expect(screen.queryByTestId("confirm-sheet")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "지출 추가" })).toBeNull();
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

  // U2: 스크롤 대신 지출 추가 시트를 해당 탭으로 열고 첫 버튼에 포커스만 줘요.
  it("?add=receipt 는 지출 추가 시트를 영수증 탭으로 열고 첫 버튼에 포커스만 줘요", async () => {
    search = "add=receipt";
    render(<LedgerShell tripId="t1" />);
    const dialog = await screen.findByRole("dialog", { name: "지출 추가" });
    expect(dialog).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "영수증" }).getAttribute("aria-selected")
    ).toBe("true");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText("영수증 촬영하기"))
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirm-sheet")).toBeNull();
  });

  it("?add=voice 는 지출 추가 시트를 음성 탭으로 열어요", async () => {
    search = "add=voice";
    render(<LedgerShell tripId="t1" />);
    await screen.findByRole("dialog", { name: "지출 추가" });
    expect(
      screen.getByRole("tab", { name: "음성" }).getAttribute("aria-selected")
    ).toBe("true");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText("음성 입력"))
    );
    expect(screen.queryByTestId("confirm-sheet")).toBeNull();
  });

  it("?settings=fx 는 설정 시트를 열어요", async () => {
    search = "settings=fx";
    render(<LedgerShell tripId="t1" />);
    await waitFor(() =>
      expect(screen.getByText("카드 수수료 추가")).toBeTruthy()
    );
    expect(screen.getByRole("dialog", { name: "설정" })).toBeTruthy();
  });

  it("저장하면 목록을 다시 불러오고 「지출을 저장했어요」 토스트를 띄워요", async () => {
    search = "add=manual";
    render(
      <ToastProvider>
        <LedgerShell tripId="t1" />
      </ToastProvider>
    );
    await screen.findByTestId("confirm-sheet");
    const props = confirmSheet.mock.calls.at(-1)![0] as { onSaved: () => void };
    const before = listExpenses.mock.calls.length;
    act(() => props.onSaved());
    expect(await screen.findByText("지출을 저장했어요")).toBeTruthy();
    await waitFor(() => expect(listExpenses.mock.calls.length).toBe(before + 1));
  });

  it("알 수 없는 값은 무시해요", async () => {
    search = "add=hack&settings=other";
    render(<LedgerShell tripId="t1" />);
    await loaded();
    expect(screen.queryByTestId("confirm-sheet")).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("LedgerShell 익명 게스트 읽기 전용", () => {
  it("직접 입력·업로더·설정이 없고 제안 슬롯만 보여요", async () => {
    useAuth.mockReturnValue({
      user: { id: "anon", user_metadata: {}, is_anonymous: true },
      provider: "supabase",
      isAnonymous: true,
    });
    listMembers.mockResolvedValue([
      {
        id: "m1",
        tripId: "t1",
        displayName: "민수",
        isOwner: false,
        userId: "anon",
      },
    ]);
    render(<LedgerShell tripId="t1" />);
    await loaded();
    expect(screen.queryByRole("button", { name: "직접 입력" })).toBeNull();
    expect(screen.queryByText("영수증 촬영하기")).toBeNull();
    expect(screen.queryByText("음성 입력")).toBeNull();
    expect(screen.queryByText("붙여넣기 분석")).toBeNull();
    expect(screen.queryByText("카드 수수료 추가")).toBeNull();
    expect(screen.getByText("내가 낸 지출")).toBeTruthy();
    expect(screen.getByRole("button", { name: "내가 냈어요" })).toBeTruthy();
  });

  it("익명이면 ?add=manual 바로가기도 열지 않아요", async () => {
    useAuth.mockReturnValue({
      user: { id: "anon", user_metadata: {}, is_anonymous: true },
      provider: "supabase",
      isAnonymous: true,
    });
    search = "add=manual";
    render(<LedgerShell tripId="t1" />);
    await loaded();
    expect(screen.queryByTestId("confirm-sheet")).toBeNull();
  });
});
