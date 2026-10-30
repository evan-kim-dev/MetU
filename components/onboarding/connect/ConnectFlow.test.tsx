// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({
    isReady: true,
    provider: "kakao",
    isLoggedIn: true,
  }),
}));

vi.mock("@/lib/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("@/lib/hooks/useAutomationStatus", () => ({
  useAutomationStatus: () => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
    uiState: null,
    rateSlow: false,
  }),
}));

vi.mock("@/lib/trips/TripProvider", () => ({
  useTrips: () => ({
    trips: [],
    activeTrips: [],
    isReady: true,
  }),
}));

vi.mock("@/lib/api/fetch-json", () => ({
  apiFetchJson: vi.fn(async () => ({
    ok: true,
    data: { tokens: [] },
  })),
}));

vi.mock("@/components/onboarding/guide/ShortcutGuide", () => ({
  ShortcutGuide: () => <div>guide</div>,
}));

vi.mock("@/components/onboarding/connect/DevCurlFold", () => ({
  DevCurlFold: () => null,
}));

import { ConnectFlow } from "@/components/onboarding/connect/ConnectFlow";
import { CONNECT_STORAGE_KEY } from "@/lib/onboarding/connect-storage";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("ConnectFlow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window.navigator, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });
  });

  it("restores phase without token", async () => {
    sessionStorage.setItem(
      CONNECT_STORAGE_KEY,
      JSON.stringify({
        phase: "shortcut",
        platform: "ios",
        ios27: true,
        selectedApps: [],
        serverOk: false,
        deviceOk: false,
      })
    );
    render(<ConnectFlow />);
    await waitFor(() => {
      expect(screen.getByText("단축어 추가")).toBeTruthy();
    });
    expect(
      screen.getByText(/연결 코드는 보안상 다시 보여 드릴 수 없어요/)
    ).toBeTruthy();
    const raw = sessionStorage.getItem(CONNECT_STORAGE_KEY) ?? "";
    expect(raw).not.toMatch(/metu-/i);
  });

  it("exactly one 나중에 하기 and no 건너뛰", async () => {
    render(<ConnectFlow />);
    await waitFor(() => {
      expect(
        screen.getByText(/연결할 기기를 확인했어요: iPhone/)
      ).toBeTruthy();
    });
    expect(screen.getAllByRole("button", { name: /나중에 하기/ })).toHaveLength(
      1
    );
    expect(screen.queryByText(/건너뛰/)).toBeNull();
  });
});
