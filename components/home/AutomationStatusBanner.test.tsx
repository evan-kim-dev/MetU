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
vi.mock("@/lib/onboarding/first-run", () => ({
  useFirstRunVisible: () => false,
}));

import { AutomationStatusBanner } from "@/components/home/AutomationStatusBanner";

afterEach(() => {
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
        "자동 기록이 꺼져 있어요 · 카드 알림을 연결하면 지출이 자동으로 적혀요"
      )
    ).toBeTruthy();
    expect(screen.getByText("연결하기")).toBeTruthy();
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
