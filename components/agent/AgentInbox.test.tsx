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

const useAuth = vi.fn();
const useTrips = vi.fn();
const useAutomationStatus = vi.fn();
const fromMock = vi.fn();
const getBrowserSupabase = vi.fn();

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => useAuth(),
}));
vi.mock("@/lib/trips/TripProvider", () => ({
  useTrips: () => useTrips(),
}));
vi.mock("@/lib/hooks/useAutomationStatus", () => ({
  useAutomationStatus: (...a: unknown[]) => useAutomationStatus(...a),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => getBrowserSupabase(),
}));
vi.mock("@/components/trips/QuickTripSheet", () => ({
  QuickTripSheet: ({
    open,
  }: {
    open: boolean;
  }) => (open ? <div data-testid="quick-trip-sheet" /> : null),
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

import { AgentInbox } from "@/components/agent/AgentInbox";

function chainQuery(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  q.select = vi.fn(self);
  q.eq = vi.fn(self);
  q.order = vi.fn(self);
  q.limit = vi.fn(() => Promise.resolve(result));
  return q;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  useTrips.mockReturnValue({
    activeTrips: [],
    trips: [],
    isReady: true,
  });
  useAutomationStatus.mockReturnValue({
    data: null,
    uiState: "off",
    loading: false,
    error: null,
  });
});

describe("AgentInbox", () => {
  it("guest: login card only, no error/empty/filter", async () => {
    useAuth.mockReturnValue({
      user: null,
      provider: "guest",
      isReady: true,
      isLoggedIn: true,
    });
    getBrowserSupabase.mockReturnValue(null);
    render(<AgentInbox />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "수신함"
    );
    expect(screen.queryByText("에이전트 인박스")).toBeNull();
    expect(
      screen.getByText("로그인하면 받은 알림을 볼 수 있어요")
    ).toBeTruthy();
    expect(screen.queryByText(/로그인 후 인박스/)).toBeNull();
    expect(screen.queryByText("아직 받은 알림이 없어요")).toBeNull();
    expect(screen.queryByText(/건만 보기/)).toBeNull();
  });

  it("query error hides raw message and offers reload", async () => {
    useAuth.mockReturnValue({
      user: { id: "u1" },
      provider: "kakao",
      isReady: true,
      isLoggedIn: true,
    });
    fromMock.mockReturnValue(
      chainQuery({ data: null, error: { message: "JWT expired raw-secret" } })
    );
    getBrowserSupabase.mockReturnValue({
      from: fromMock,
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), }),
      removeChannel: vi.fn(),
    });
    // simplify realtime
    getBrowserSupabase.mockReturnValue({
      from: fromMock,
      channel: () => {
        const ch = {
          on: () => ch,
          subscribe: () => ch,
        };
        return ch;
      },
      removeChannel: vi.fn(),
    });

    render(<AgentInbox />);
    expect(await screen.findByText("알림을 불러오지 못했어요.")).toBeTruthy();
    expect(screen.queryByText(/JWT expired/)).toBeNull();
    expect(screen.queryByText(/raw-secret/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    await waitFor(() => expect(fromMock).toHaveBeenCalled());
  });

  it("empty state: not connected", async () => {
    useAuth.mockReturnValue({
      user: { id: "u1" },
      provider: "kakao",
      isReady: true,
      isLoggedIn: true,
    });
    useAutomationStatus.mockReturnValue({
      data: { status: "pending" },
      uiState: "off",
      loading: false,
      error: null,
    });
    fromMock.mockReturnValue(chainQuery({ data: [], error: null }));
    getBrowserSupabase.mockReturnValue({
      from: fromMock,
      channel: () => {
        const ch = { on: () => ch, subscribe: () => ch };
        return ch;
      },
      removeChannel: vi.fn(),
    });
    render(<AgentInbox />);
    expect(await screen.findByText("아직 받은 알림이 없어요")).toBeTruthy();
    expect(
      screen.getByText(
        "카드 알림 자동 기록을 연결하면 결제 알림이 여기에 모여요."
      )
    ).toBeTruthy();
    expect(screen.getByText("자동 기록 연결하기")).toBeTruthy();
  });

  it("empty state: connected ok", async () => {
    useAuth.mockReturnValue({
      user: { id: "u1" },
      provider: "kakao",
      isReady: true,
      isLoggedIn: true,
    });
    useAutomationStatus.mockReturnValue({
      data: { status: "done" },
      uiState: "ok",
      loading: false,
      error: null,
    });
    fromMock.mockReturnValue(chainQuery({ data: [], error: null }));
    getBrowserSupabase.mockReturnValue({
      from: fromMock,
      channel: () => {
        const ch = { on: () => ch, subscribe: () => ch };
        return ch;
      },
      removeChannel: vi.fn(),
    });
    render(<AgentInbox />);
    expect(
      await screen.findByText("연결은 됐어요. 알림이 오면 여기에 나타나요.")
    ).toBeTruthy();
    expect(screen.getByText("연결 상태 확인")).toBeTruthy();
  });

  it("no trips + unassigned shows yellow card and opens sheet", async () => {
    useAuth.mockReturnValue({
      user: { id: "u1" },
      provider: "kakao",
      isReady: true,
      isLoggedIn: true,
    });
    fromMock.mockReturnValue(
      chainQuery({
        data: [
          {
            id: "e1",
            trip_id: null,
            source: "sms",
            kind: "sms",
            status: "unassigned",
            payload: { text: "결제 1000원" },
            result: null,
            error: null,
            created_at: "2026-10-31T00:00:00Z",
            processed_at: null,
          },
        ],
        error: null,
      })
    );
    getBrowserSupabase.mockReturnValue({
      from: fromMock,
      channel: () => {
        const ch = { on: () => ch, subscribe: () => ch };
        return ch;
      },
      removeChannel: vi.fn(),
    });
    render(<AgentInbox />);
    expect(
      await screen.findByText(/여행이 없어서 알림 1건을 보관 중이에요/)
    ).toBeTruthy();
    const openBtns = screen.getAllByRole("button", { name: "여행 만들기" });
    fireEvent.click(openBtns[0]!);
    expect(screen.getByTestId("quick-trip-sheet")).toBeTruthy();
  });

  it("toggles filter aria-pressed", async () => {
    useAuth.mockReturnValue({
      user: { id: "u1" },
      provider: "kakao",
      isReady: true,
      isLoggedIn: true,
    });
    useTrips.mockReturnValue({
      activeTrips: [{ id: "t1", destination: "도쿄", dateRange: "x" }],
      trips: [{ id: "t1", destination: "도쿄", dateRange: "x" }],
      isReady: true,
    });
    fromMock.mockReturnValue(
      chainQuery({
        data: [
          {
            id: "e1",
            trip_id: null,
            source: "sms",
            kind: "sms",
            status: "unassigned",
            payload: { text: "결제" },
            result: null,
            error: null,
            created_at: "2026-10-31T00:00:00Z",
            processed_at: null,
          },
        ],
        error: null,
      })
    );
    getBrowserSupabase.mockReturnValue({
      from: fromMock,
      channel: () => {
        const ch = { on: () => ch, subscribe: () => ch };
        return ch;
      },
      removeChannel: vi.fn(),
    });
    render(<AgentInbox />);
    const filter = await screen.findByRole("button", {
      name: "여행 없는 알림 1건만 보기",
    });
    expect(filter.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(filter);
    expect(
      screen.getByRole("button", { name: "전체 보기" }).getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
  });
});
