// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useAuth = vi.fn();
const useAutomationStatus = vi.fn();

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => useAuth(),
}));
vi.mock("@/lib/hooks/useAutomationStatus", () => ({
  useAutomationStatus: (...a: unknown[]) => useAutomationStatus(...a),
}));
let firstRunVisible = false;
vi.mock("@/lib/onboarding/first-run", () => ({
  useFirstRunVisible: () => firstRunVisible,
}));

import { AutomationStatusBanner } from "@/components/home/AutomationStatusBanner";

afterEach(() => {
  firstRunVisible = false;
  cleanup();
  vi.clearAllMocks();
});

describe("AutomationStatusBanner", () => {
  it("renders off copy", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "kakao",
    });
    useAutomationStatus.mockReturnValue({
      data: {
        status: "pending",
        platform: "ios",
        lastNotificationAt: null,
      },
      loading: false,
      error: null,
      uiState: "off",
    });
    render(<AutomationStatusBanner />);
    expect(
      screen.getByText(
        "자동 기록 꺼짐 · 연결하면 카드 알림이 가계부에 자동으로 적혀요"
      )
    ).toBeTruthy();
    expect(screen.getByText("연결하기")).toBeTruthy();
  });

  it("skipped/pending 도 off 로 보이고, 첫 실행 체크리스트 중엔 홈에서만 숨겨요", () => {
    firstRunVisible = true;
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "kakao",
    });
    useAutomationStatus.mockReturnValue({
      data: {
        status: "skipped",
        platform: null,
        lastNotificationAt: null,
      },
      loading: false,
      error: null,
      uiState: "off",
    });
    const home = render(<AutomationStatusBanner />);
    expect(home.container.textContent).toBe("");
    home.unmount();

    // 가계부(/agent)·내 여행(/trips) 처럼 체크리스트가 없는 화면
    render(<AutomationStatusBanner ignoreFirstRun />);
    expect(screen.getByText(/자동 기록 꺼짐/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "연결하기" }).getAttribute("href")
    ).toBe("/onboarding/automation");
  });

  it("renders unverified copy", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "kakao",
    });
    useAutomationStatus.mockReturnValue({
      data: { status: "partial", platform: "ios", lastNotificationAt: null },
      loading: false,
      error: null,
      uiState: "unverified",
    });
    render(<AutomationStatusBanner />);
    expect(
      screen.getByText(
        "연결을 확인하지 못했어요 · 테스트 알림을 한 번 받아 보세요"
      )
    ).toBeTruthy();
  });

  it("renders silent copy", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "kakao",
    });
    useAutomationStatus.mockReturnValue({
      data: {
        status: "done",
        platform: "ios",
        lastNotificationAt: "2026-10-01T00:00:00Z",
      },
      loading: false,
      error: null,
      uiState: "silent",
    });
    render(<AutomationStatusBanner />);
    expect(
      screen.getByText(
        "최근 24시간 동안 받은 알림이 없어요 · 자동화가 켜져 있는지 확인해 보세요"
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "관리" }).getAttribute("href")
    ).toBe("/onboarding/automation");
  });

  it("renders ok copy", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "kakao",
    });
    useAutomationStatus.mockReturnValue({
      data: {
        status: "done",
        platform: "ios",
        lastNotificationAt: new Date().toISOString(),
      },
      loading: false,
      error: null,
      uiState: "ok",
    });
    render(<AutomationStatusBanner />);
    expect(screen.getByText(/자동 기록 켜짐 · 마지막 수신/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "관리" }).getAttribute("href")
    ).toBe("/onboarding/automation");
  });

  it("does not render for guest/loading/error", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "guest",
    });
    useAutomationStatus.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      uiState: null,
    });
    const { container } = render(<AutomationStatusBanner />);
    expect(container.textContent).toBe("");
  });
});
