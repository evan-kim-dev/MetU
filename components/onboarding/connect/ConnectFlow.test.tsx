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

let statusData: Record<string, unknown> | null = null;
vi.mock("@/lib/hooks/useAutomationStatus", () => ({
  useAutomationStatus: () => ({
    data: statusData,
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
  statusData = null;
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
      expect(screen.getByRole("heading", { name: "단축어 추가" })).toBeTruthy();
    });
    expect(
      screen.getByText(/연결 코드는 보안상 다시 보여 드릴 수 없어요/)
    ).toBeTruthy();
    const raw = sessionStorage.getItem(CONNECT_STORAGE_KEY) ?? "";
    expect(raw).not.toMatch(/metu-/i);
  });

  it("단계 카드 5개: 현재 단계 aria-current, 완료 단계는 눌러서 돌아갈 수 있어요", async () => {
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
    const nav = await screen.findByRole("navigation", { name: "연결 단계" });
    expect(nav.querySelectorAll("li")).toHaveLength(5);
    const current = nav.querySelector("[aria-current=\"step\"]");
    expect(current?.textContent).toContain("단축어 추가");
    expect(current?.textContent).toContain("진행 중");
    expect(nav.textContent).toContain("대기");
    expect(nav.textContent).toContain("완료");
    fireEvent.click(
      screen.getByRole("button", { name: /연결 코드, 완료/ })
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /연결 코드/ })).toBeTruthy();
    });
  });

  describe("연결 확인(verify): 진짜 알림만 인정", () => {
    const STARTED = "2026-10-31T00:00:00.000Z";
    function restoreVerify() {
      sessionStorage.setItem(
        CONNECT_STORAGE_KEY,
        JSON.stringify({
          phase: "verify",
          platform: "ios",
          ios27: true,
          selectedApps: [],
          serverOk: false,
          deviceOk: false,
          verifyStartedAt: STARTED,
        })
      );
    }
    const base = {
      status: "partial",
      platform: "ios",
      selectedApps: [],
      lastNotificationAt: "2026-10-01T00:00:00.000Z",
      lastDeviceTestAt: "2026-10-01T00:00:00.000Z",
      lastServerTestAt: null,
      lastDroppedApp: null,
      state: "ok",
      hasActiveToken: true,
      activeTrip: false,
      recentEvents: [],
      unassignedCount: 0,
    };

    it("예전에 연결에 성공한 계정이어도 새 알림이 없으면 기다리는 중이에요", async () => {
      restoreVerify();
      statusData = {
        ...base,
        lastRealEventAt: "2026-10-15T00:00:00.000Z",
      };
      render(<ConnectFlow />);
      await screen.findByText("알림을 기다리는 중이에요");
      expect(screen.queryByText("완료하고 홈으로")).toBeNull();
      expect(screen.getByText("일단 완료하고 나중에 확인할게요")).toBeTruthy();
    });

    it("확인 단계 진입 뒤 실제 알림이 오면 완료하고 홈으로가 나와요", async () => {
      restoreVerify();
      statusData = {
        ...base,
        lastRealEventAt: "2026-10-31T00:00:30.000Z",
        recentEvents: [
          {
            id: "e1",
            status: "unassigned",
            createdAt: "2026-10-31T00:00:30.000Z",
            source: "notification",
            tripId: null,
            textPreview: "승인 12,500원",
            error: null,
            reason: null,
            isTest: false,
          },
        ],
      };
      render(<ConnectFlow />);
      await screen.findByText("완료하고 홈으로");
      expect(screen.getByText("아직 여행에 안 붙었어요")).toBeTruthy();
    });

    it("연결 테스트(MTU-TEST)만 오면 연결 OK 이고 실제 알림은 계속 기다려요", async () => {
      restoreVerify();
      statusData = {
        ...base,
        lastRealEventAt: null,
        lastDeviceTestAt: "2026-10-31T00:00:20.000Z",
      };
      render(<ConnectFlow />);
      await screen.findByText("완료하고 홈으로");
      expect(screen.getByTestId("stage-test").getAttribute("data-status")).toBe(
        "done"
      );
      expect(screen.getByTestId("stage-real").getAttribute("data-status")).toBe(
        "current"
      );
    });
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
