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
  describe("미배정 제안 / 모두 붙이기", () => {
    const tokyo = {
      id: "t1",
      destination: "도쿄",
      dateRange: "2026-07-20 · 3박 4일",
      startDate: "2026-07-20",
      endDate: "2026-07-23",
      status: "upcoming",
    };
    const osaka = {
      id: "t2",
      destination: "오사카",
      dateRange: "2026-09-01 · 3박 4일",
      startDate: "2026-09-01",
      endDate: "2026-09-04",
      status: "upcoming",
    };

    function unassigned(id: string, createdAt: string, result: unknown = null) {
      return {
        id,
        trip_id: null,
        source: "sms_shortcut",
        kind: "text",
        status: "unassigned",
        payload: { text: "결제 12,500원 스타벅스", received_at: createdAt },
        result,
        error: null,
        created_at: createdAt,
        processed_at: null,
      };
    }

    function setup(events: unknown[], trips: unknown[]) {
      useAuth.mockReturnValue({
        user: { id: "u1" },
        provider: "kakao",
        isReady: true,
        isLoggedIn: true,
      });
      useTrips.mockReturnValue({
        activeTrips: trips,
        trips,
        isReady: true,
      });
      fromMock.mockReturnValue(chainQuery({ data: events, error: null }));
      getBrowserSupabase.mockReturnValue({
        from: fromMock,
        channel: () => {
          const ch = { on: () => ch, subscribe: () => ch };
          return ch;
        },
        removeChannel: vi.fn(),
      });
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true }),
      }));
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("날짜가 맞는 여행이 있으면 '○○ 여행에 붙이기' 를 보여주고, 누르면 assign API 를 호출한다", async () => {
      const fetchMock = setup(
        [unassigned("e1", "2026-07-21T03:00:00Z")],
        [tokyo]
      );
      render(<AgentInbox />);

      const btn = await screen.findByRole("button", {
        name: "도쿄 여행에 붙이기",
      });
      expect(btn.className).toContain("min-h-11");
      expect(screen.getByText(/도쿄 여행\(7\/20~23\) 기간에 맞아요/)).toBeTruthy();

      fireEvent.click(btn);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const [url, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe("/api/agent/events/e1/assign");
      expect(JSON.parse(init.body as string)).toEqual({ tripId: "t1" });
    });

    it("날짜가 다르면 가장 가까운 여행을 제안하고 사유 문구를 보여준다", async () => {
      setup([unassigned("e1", "2026-01-10T03:00:00Z")], [tokyo, osaka]);
      render(<AgentInbox />);

      expect(
        await screen.findByText("도쿄 여행(7/20~23)과 날짜가 달라요. 붙일까요?")
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "도쿄 여행에 붙이기" })
      ).toBeTruthy();
      expect(screen.queryByText(/여행이 없어서/)).toBeNull();
    });

    it("같은 여행으로 붙는 미배정이 2건 이상이면 'N건 모두 ○○에 붙이기' 가 순차 호출된다", async () => {
      const fetchMock = setup(
        [
          unassigned("e1", "2026-07-21T03:00:00Z"),
          unassigned("e2", "2026-07-22T03:00:00Z"),
          unassigned("e3", "2026-07-22T05:00:00Z"),
        ],
        [tokyo]
      );
      render(<AgentInbox />);

      const bulkBtn = await screen.findByRole("button", {
        name: "3건 모두 도쿄에 붙이기",
      });
      fireEvent.click(bulkBtn);

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      const urls = fetchMock.mock.calls.map(
        (c) => (c as unknown as [string])[0]
      );
      expect(urls).toEqual([
        "/api/agent/events/e1/assign",
        "/api/agent/events/e2/assign",
        "/api/agent/events/e3/assign",
      ]);
      expect(await screen.findByText("3건을 모두 붙였어요")).toBeTruthy();
    });

    it("모두 붙이기 중 일부가 실패하면 실패 건수를 알려준다", async () => {
      const fetchMock = setup(
        [
          unassigned("e1", "2026-07-21T03:00:00Z"),
          unassigned("e2", "2026-07-22T03:00:00Z"),
        ],
        [tokyo]
      );
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as never)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: "forbidden" }),
        } as never);
      render(<AgentInbox />);

      fireEvent.click(
        await screen.findByRole("button", { name: "2건 모두 도쿄에 붙이기" })
      );
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("2건 중 1건을 붙이지 못했어요");
    });

    it("미배정이 1건이면 모두 붙이기는 없다", async () => {
      setup([unassigned("e1", "2026-07-21T03:00:00Z")], [tokyo]);
      render(<AgentInbox />);
      await screen.findByRole("button", { name: "도쿄 여행에 붙이기" });
      expect(screen.queryByText(/건 모두/)).toBeNull();
    });

    it("여행이 0개면 '여행을 만들면 자동으로 붙어요' + 여행 만들기", async () => {
      setup([unassigned("e1", "2026-07-21T03:00:00Z")], []);
      render(<AgentInbox />);
      expect(
        await screen.findByText("여행을 만들면 자동으로 붙어요")
      ).toBeTruthy();
      expect(screen.queryByText(/붙이기$/)).toBeNull();
      fireEvent.click(screen.getAllByRole("button", { name: "여행 만들기" })[0]!);
      expect(screen.getByTestId("quick-trip-sheet")).toBeTruthy();
    });

    it("공유받은 여행(isOwner=false)은 선택지에 \"· 공유받음\" 으로 나온다", async () => {
      setup(
        [unassigned("e1", "2026-07-21T03:00:00Z", { reason: "no_dates" })],
        [
          {
            id: "t1",
            destination: "A",
            dateRange: "미정",
            status: "upcoming",
            isOwner: true,
          },
          {
            id: "t2",
            destination: "B",
            dateRange: "미정",
            status: "upcoming",
            isOwner: false,
          },
        ]
      );
      render(<AgentInbox />);

      const select = (await screen.findByRole("combobox")) as HTMLSelectElement;
      const labels = Array.from(select.options).map((o) => o.textContent);
      expect(labels).toContain("B · 미정 · 공유받음");
      // 내 여행에는 붙지 않는다
      expect(labels).toContain("A · 미정");
      expect(labels.some((l) => l?.startsWith("A") && l.includes("공유받음"))).toBe(
        false
      );
    });

    it("여행은 있지만 날짜를 못 읽으면 '여행 날짜를 넣으면 자동으로 붙어요'", async () => {
      setup(
        [unassigned("e1", "2026-07-21T03:00:00Z", { reason: "no_dates" })],
        [
          { id: "t1", destination: "A", dateRange: "미정", status: "upcoming" },
          { id: "t2", destination: "B", dateRange: "미정", status: "upcoming" },
        ]
      );
      render(<AgentInbox />);
      expect(
        await screen.findByText("여행 날짜를 넣으면 자동으로 붙어요")
      ).toBeTruthy();
      expect(screen.getByRole("combobox")).toBeTruthy();
    });
  });});
