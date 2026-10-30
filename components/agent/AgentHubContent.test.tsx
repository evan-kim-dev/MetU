// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useAuth = vi.fn();
const useTrips = vi.fn();
const useAutomationStatus = vi.fn();

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => useAuth(),
}));
vi.mock("@/lib/trips/TripProvider", () => ({
  useTrips: () => useTrips(),
}));
vi.mock("@/lib/hooks/useAutomationStatus", () => ({
  useAutomationStatus: (...a: unknown[]) => useAutomationStatus(...a),
}));
vi.mock("@/components/trips/QuickTripSheet", () => ({
  QuickTripSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="quick-trip-sheet" /> : null,
}));
vi.mock("@/components/layout/MobileShell", () => ({
  MobileShell: ({
    title,
    children,
  }: {
    title?: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

import { AgentHubContent } from "@/components/agent/AgentHubContent";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AgentHubContent", () => {
  it("removes developer copy", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "kakao",
    });
    useTrips.mockReturnValue({
      trips: [],
      activeTrips: [],
      isReady: true,
    });
    useAutomationStatus.mockReturnValue({
      uiState: "ok",
      loading: false,
      error: null,
    });
    render(<AgentHubContent />);
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("해커톤");
    expect(text).not.toContain("/join/토큰");
    expect(text).not.toContain("/s/토큰");
    expect(text).not.toContain("/board)");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "가계부·자동 기록"
    );
  });

  it("opens quick trip when no trips", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "kakao",
    });
    useTrips.mockReturnValue({
      trips: [],
      activeTrips: [],
      isReady: true,
    });
    useAutomationStatus.mockReturnValue({
      uiState: "off",
      loading: false,
      error: null,
    });
    render(<AgentHubContent />);
    fireEvent.click(
      screen.getByRole("button", { name: "빠르게 여행 만들기" })
    );
    expect(screen.getByTestId("quick-trip-sheet")).toBeTruthy();
  });

  it("automation card: ok shows inbox link", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "kakao",
    });
    useTrips.mockReturnValue({ trips: [], activeTrips: [], isReady: true });
    useAutomationStatus.mockReturnValue({
      uiState: "ok",
      loading: false,
      error: null,
    });
    render(<AgentHubContent />);
    expect(
      screen.getByText("카드 알림 자동 기록이 켜져 있어요")
    ).toBeTruthy();
    expect(screen.getByText("수신함 보기")).toBeTruthy();
  });

  it("automation card: off shows connect", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "kakao",
    });
    useTrips.mockReturnValue({ trips: [], activeTrips: [], isReady: true });
    useAutomationStatus.mockReturnValue({
      uiState: "off",
      loading: false,
      error: null,
    });
    render(<AgentHubContent />);
    expect(
      screen.getByText("카드 알림을 자동으로 기록해 보세요")
    ).toBeTruthy();
    expect(screen.getByText("연결하기")).toBeTruthy();
  });

  it("hides automation card for guest / loading / error", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "guest",
    });
    useTrips.mockReturnValue({ trips: [], activeTrips: [], isReady: true });
    useAutomationStatus.mockReturnValue({
      uiState: "ok",
      loading: false,
      error: null,
    });
    const { rerender } = render(<AgentHubContent />);
    expect(
      screen.queryByText("카드 알림 자동 기록이 켜져 있어요")
    ).toBeNull();

    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "kakao",
    });
    useAutomationStatus.mockReturnValue({
      uiState: "ok",
      loading: true,
      error: null,
    });
    rerender(<AgentHubContent />);
    expect(
      screen.queryByText("카드 알림 자동 기록이 켜져 있어요")
    ).toBeNull();

    useAutomationStatus.mockReturnValue({
      uiState: null,
      loading: false,
      error: { message: "x" },
    });
    rerender(<AgentHubContent />);
    expect(
      screen.queryByText("카드 알림 자동 기록이 켜져 있어요")
    ).toBeNull();
  });
});
