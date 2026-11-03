// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let search = "";
const push = vi.fn();
const replace = vi.fn();
const useAuth = vi.fn();
const listMembers = vi.fn();
const listExpenses = vi.fn();
const fetchLatestSettlement = vi.fn();
const getBrowserSupabase = vi.fn();
const useAutomationStatus = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push, replace }),
}));
vi.mock("@/lib/auth/AuthProvider", () => ({ useAuth: () => useAuth() }));
vi.mock("@/lib/hooks/useAutomationStatus", () => ({
  useAutomationStatus: (...a: unknown[]) => useAutomationStatus(...a),
}));
vi.mock("@/lib/ledger/supabase", () => ({
  listMembers: (...a: unknown[]) => listMembers(...a),
  listExpenses: (...a: unknown[]) => listExpenses(...a),
  listCardProfiles: vi.fn(async () => []),
  ensureOwnerMember: vi.fn(),
  fetchLatestSettlement: (...a: unknown[]) => fetchLatestSettlement(...a),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => getBrowserSupabase(),
}));
vi.mock("@/components/ledger/ExpenseConfirmSheet", () => ({
  ExpenseConfirmSheet: () => null,
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
  CashRateSettings: () => null,
}));
vi.mock("@/components/trips/ledger/TripInvitePanel", () => ({
  TripInvitePanel: () => <div>초대 패널</div>,
}));
vi.mock("@/components/ui/OfflineBanner", () => ({
  OfflineBanner: () => null,
}));
vi.mock("@/components/ledger/SplitBatchBox", () => ({
  SplitBatchBox: () => <div>한 줄 분담</div>,
}));
vi.mock("@/components/ledger/GuestExpenseSlot", () => ({
  GuestExpenseSlot: () => <div>내가 냈어요 슬롯</div>,
}));
vi.mock("@/components/ledger/ExpenseChipSplit", () => ({
  ExpenseChipSplit: ({ expense }: { expense: { merchant: string } }) => (
    <li>칩 {expense.merchant}</li>
  ),
}));
vi.mock("@/components/ledger/MyShareCard", () => ({
  MyShareCard: () => <div>내 몫 카드</div>,
}));

import { TripJourney } from "./TripJourney";

beforeEach(() => {
  search = "";
  push.mockReset();
  replace.mockReset();
  useAuth.mockReturnValue({
    user: { id: "u1", user_metadata: {} },
    provider: "kakao",
    isReady: true,
    isLoggedIn: true,
  });
  useAutomationStatus.mockReturnValue({
    data: { hasActiveToken: true },
    loading: false,
    error: null,
  });
  listMembers.mockResolvedValue([
    { id: "m1", tripId: "t1", displayName: "가나", isOwner: true, userId: "u1" },
    { id: "m2", tripId: "t1", displayName: "다라", isOwner: false, userId: "u2" },
  ]);
  listExpenses.mockResolvedValue([
    { id: "e1", krwAmount: 1000, merchant: "카페", label: "카페" },
  ]);
  fetchLatestSettlement.mockResolvedValue({ ok: true, settlement: null });
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => Promise.resolve({ count: 0, error: null }),
  };
  getBrowserSupabase.mockReturnValue({ from: () => chain });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TripJourney", () => {
  it("지출 있는 여행은 기본 단계 settle 로 URL을 맞춰요", async () => {
    render(<TripJourney tripId="t1" />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("step=settle"),
        { scroll: false }
      )
    );
  });

  it("?step 무효면 기본 단계로 해석해요", async () => {
    search = "step=hack";
    render(<TripJourney tripId="t1" />);
    await screen.findByRole("navigation", { name: "정산 단계" });
    // CTA for settle default
    expect(screen.getByRole("button", { name: "정산 화면 열기" })).toBeTruthy();
  });

  it("칸 탭 시 step 쿼리를 push해요", async () => {
    search = "step=settle";
    render(<TripJourney tripId="t1" />);
    await screen.findByRole("navigation", { name: "정산 단계" });
    const nav = screen.getByRole("navigation", { name: "정산 단계" });
    const inviteBtn = Array.from(nav.querySelectorAll("button")).find((b) =>
      (b.getAttribute("aria-label") ?? "").startsWith("초대")
    );
    fireEvent.click(inviteBtn!);
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("step=invite"),
      { scroll: false }
    );
  });

  it("?add=receipt 는 record 로 정규화해요", async () => {
    search = "add=receipt";
    render(<TripJourney tripId="t1" />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("step=record"),
        { scroll: false }
      )
    );
    expect(await screen.findByText("영수증 촬영하기")).toBeTruthy();
  });

  it("?step=connect 딥링크는 연결 단계 화면을 보여 줘요", async () => {
    search = "step=connect";
    render(<TripJourney tripId="t1" />);
    expect(await screen.findByRole("heading", { name: "자동 수집이 켜져 있어요" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "다음: 멤버 초대" })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("?step=invite 딥링크는 초대 단계 화면(참여 현황)을 보여 줘요", async () => {
    search = "step=invite";
    render(<TripJourney tripId="t1" />);
    expect(await screen.findByRole("heading", { name: "참여한 사람" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "동행자를 초대해요" })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  describe("게스트(익명)", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: { id: "u2", is_anonymous: true, user_metadata: {} },
        provider: "supabase",
        isReady: true,
        isLoggedIn: true,
      });
    });

    it("?step=adjust 에 머물고 조정 도구를 보여 줘요", async () => {
      search = "step=adjust";
      render(<TripJourney tripId="t1" />);
      expect(await screen.findByText("한 줄로 내 몫 바꾸기")).toBeTruthy();
      expect(screen.getByText("한 줄 분담")).toBeTruthy();
      expect(screen.getByText("내가 냈어요 슬롯")).toBeTruthy();
      expect(await screen.findByText("칩 카페")).toBeTruthy();
      expect(replace).not.toHaveBeenCalled();
    });

    it("?step=pay 에도 머물러요", async () => {
      search = "step=pay";
      render(<TripJourney tripId="t1" />);
      await screen.findByRole("navigation", { name: "정산 단계" });
      await waitFor(() => expect(listMembers).toHaveBeenCalled());
      expect(replace).not.toHaveBeenCalled();
    });

    it("호스트 전용 단계(?step=record)는 게스트 기본 단계로 바꿔요", async () => {
      search = "step=record";
      render(<TripJourney tripId="t1" />);
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith(
          expect.stringContaining("step=share"),
          { scroll: false }
        )
      );
    });

    it("게스트 칸 탭은 게스트 키만 push 해요", async () => {
      search = "step=share";
      render(<TripJourney tripId="t1" />);
      const nav = await screen.findByRole("navigation", { name: "정산 단계" });
      const adjustBtn = Array.from(nav.querySelectorAll("button")).find((b) =>
        (b.getAttribute("aria-label") ?? "").startsWith("조정")
      );
      fireEvent.click(adjustBtn!);
      expect(push).toHaveBeenCalledWith(
        expect.stringContaining("step=adjust"),
        { scroll: false }
      );
    });
  });
});
