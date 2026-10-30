// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuth = vi.fn();
const useAutomationStatus = vi.fn();
const useTrips = vi.fn();

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => useAuth(),
}));
vi.mock("@/lib/hooks/useAutomationStatus", () => ({
  useAutomationStatus: (...a: unknown[]) => useAutomationStatus(...a),
}));
vi.mock("@/lib/trips/TripProvider", () => ({
  useTrips: () => useTrips(),
}));
vi.mock("@/components/trips/QuickTripSheet", () => ({
  QuickTripSheet: () => null,
}));

import { FirstRunChecklist } from "@/components/home/FirstRunChecklist";
import { GuestHomeCard } from "@/components/home/GuestHomeCard";
import {
  FIRST_RUN_DISMISSED_KEY,
  FIRST_RUN_DONE_KEY,
} from "@/lib/onboarding/first-run";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

function mockLoggedIn(overrides?: {
  uiState?: string;
  loading?: boolean;
  error?: unknown;
  trips?: unknown[];
  activeTrips?: unknown[];
  tripsReady?: boolean;
}) {
  useAuth.mockReturnValue({
    isReady: true,
    isLoggedIn: true,
    provider: "kakao",
  });
  useAutomationStatus.mockReturnValue({
    uiState: overrides?.uiState ?? "off",
    loading: overrides?.loading ?? false,
    error: overrides?.error ?? null,
    data: {},
  });
  const trips = overrides?.trips ?? [];
  useTrips.mockReturnValue({
    trips,
    activeTrips: overrides?.activeTrips ?? trips,
    isReady: overrides?.tripsReady ?? true,
  });
}

describe("FirstRunChecklist", () => {
  it("does not render for guests; GuestHomeCard does", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isLoggedIn: true,
      provider: "guest",
    });
    useAutomationStatus.mockReturnValue({
      uiState: null,
      loading: false,
      error: null,
    });
    useTrips.mockReturnValue({ trips: [], activeTrips: [], isReady: true });
    const { container: c1 } = render(<FirstRunChecklist />);
    expect(c1.textContent).toBe("");
    render(<GuestHomeCard />);
    expect(screen.getByText("둘러보는 중이에요")).toBeTruthy();
  });

  it("does not render while loading", () => {
    mockLoggedIn({ loading: true });
    const { container } = render(<FirstRunChecklist />);
    expect(container.textContent).toBe("");
  });

  it("hides after 숨기기 and writes localStorage", () => {
    mockLoggedIn({ uiState: "off" });
    render(<FirstRunChecklist />);
    expect(screen.getByText("시작하기")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "숨기기" }));
    expect(localStorage.getItem(FIRST_RUN_DISMISSED_KEY)).toBe("1");
    expect(screen.queryByText("시작하기")).toBeNull();
  });

  it("disables expense CTA without trip", () => {
    mockLoggedIn({ uiState: "off" });
    render(<FirstRunChecklist />);
    const btn = screen.getByRole("button", { name: "기록하기" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("먼저 여행을 만들어 주세요.")).toBeTruthy();
  });

  it("shows allDone message and persists done flag", () => {
    mockLoggedIn({
      uiState: "ok",
      trips: [
        {
          id: "t1",
          destination: "도쿄",
          expenses: [{ id: "e1" }],
          spent: 1000,
          status: "ongoing",
        },
      ],
    });
    render(<FirstRunChecklist />);
    expect(
      screen.getByText("준비 끝! 이제 알림이 오면 자동으로 기록돼요. 🎉")
    ).toBeTruthy();
    expect(localStorage.getItem(FIRST_RUN_DONE_KEY)).toBe("1");
  });

  it("sets progressbar aria-valuenow", () => {
    mockLoggedIn({
      uiState: "ok",
      trips: [
        {
          id: "t1",
          destination: "도쿄",
          expenses: [],
          spent: 0,
          status: "upcoming",
        },
      ],
    });
    render(<FirstRunChecklist />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
  });
});
