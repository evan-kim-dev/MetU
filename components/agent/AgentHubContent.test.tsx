// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EXPENSES,
  EXPENSES_TOTAL_KRW,
  MEMBERS,
  makeEvent,
  OSAKA,
  SETTLEMENT_OPEN,
  TOKYO,
} from "@/components/agent/ledger-home/ledger-home.fixtures";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatKRW } from "@/lib/shared/format";

const useAuth = vi.fn();
const useTrips = vi.fn();
const useAutomationStatus = vi.fn();
const listExpenses = vi.fn();
const listMembers = vi.fn();
const fetchLatestSettlement = vi.fn();
const getBrowserSupabase = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => useAuth(),
}));
vi.mock("@/lib/trips/TripProvider", () => ({
  useTrips: () => useTrips(),
}));
vi.mock("@/lib/hooks/useAutomationStatus", () => ({
  useAutomationStatus: (...a: unknown[]) => useAutomationStatus(...a),
}));
vi.mock("@/lib/ledger/supabase", () => ({
  listExpenses: (...a: unknown[]) => listExpenses(...a),
  listMembers: (...a: unknown[]) => listMembers(...a),
  fetchLatestSettlement: (...a: unknown[]) => fetchLatestSettlement(...a),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => getBrowserSupabase(),
}));
vi.mock("@/components/trips/QuickTripSheet", () => ({
  QuickTripSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="quick-trip-sheet" /> : null,
}));
vi.mock("@/components/agent/DemoModePanel", () => ({
  DemoModePanel: () => <div data-testid="demo-panel" />,
}));
vi.mock("@/components/layout/MobileShell", () => ({
  MobileShell: ({
    title,
    children,
    rightSlot,
  }: {
    title?: string;
    children: React.ReactNode;
    rightSlot?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {rightSlot}
      {children}
    </div>
  ),
}));

import { AgentHubContent } from "@/components/agent/AgentHubContent";

/** agent_events 건수 쿼리 체인: select().eq().eq().in() */
function supabaseWithPending(count: number) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => Promise.resolve({ count, error: null }),
  };
  return { from: () => chain };
}

/** 헤더 총지출 숫자가 나타날 때까지 기다린다 */
async function totalShown() {
  const el = await screen.findByTestId("trip-total-krw");
  expect(el.textContent).toBe(formatKRW(EXPENSES_TOTAL_KRW));
}

function login(provider = "kakao") {
  useAuth.mockReturnValue({
    isReady: true,
    isLoggedIn: true,
    provider,
    user: { id: "u1" },
  });
}

function automation(over: Record<string, unknown> = {}) {
  useAutomationStatus.mockReturnValue({
    uiState: "ok",
    loading: false,
    error: null,
    data: { unassignedCount: 0, recentEvents: [] },
    refresh,
    ...over,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  login();
  automation();
  useTrips.mockReturnValue({
    trips: [OSAKA, TOKYO],
    activeTrips: [OSAKA, TOKYO],
    isReady: true,
  });
  getBrowserSupabase.mockReturnValue(supabaseWithPending(0));
  listMembers.mockResolvedValue(MEMBERS);
  listExpenses.mockImplementation(async (_s: unknown, tripId: string) =>
    tripId === TOKYO.id ? EXPENSES : []
  );
  fetchLatestSettlement.mockImplementation(
    async (_s: unknown, tripId: string) => ({
      ok: true,
      settlement: tripId === TOKYO.id ? SETTLEMENT_OPEN : null,
    })
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("AgentHubContent", () => {
  it("제목은 '가계부'이고 개발자 문구가 없어요", async () => {
    render(<AgentHubContent />);
    await totalShown();
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("해커톤");
    expect(text).not.toContain("/join/토큰");
    expect(text).not.toContain("/s/토큰");
    expect(text).not.toContain("/board)");
    expect(text).not.toContain("공통 진입");
    expect(text).not.toContain("가계부·정산 모아보기");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("가계부");
  });

  it("게스트는 로그인을 유도하고 데이터·알약·데모·더보기를 숨겨요", () => {
    login("guest");
    render(<AgentHubContent />);
    expect(screen.getByText("로그인하면 가계부를 쓸 수 있어요")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "로그인하기" }).getAttribute("href")
    ).toBe("/login?next=/agent");
    expect(screen.queryByTestId("automation-pill")).toBeNull();
    expect(screen.queryByTestId("demo-panel")).toBeNull();
    expect(screen.queryByRole("button", { name: "더보기" })).toBeNull();
    expect(listExpenses).not.toHaveBeenCalled();
  });

  it("여행 로딩 중에는 aria-busy 스켈레톤을 보여요", () => {
    useTrips.mockReturnValue({ trips: [], activeTrips: [], isReady: false });
    render(<AgentHubContent />);
    const busy = screen.getByLabelText("불러오는 중");
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("여행을 만들면 가계부가 시작돼요")).toBeNull();
  });

  it("여행이 없으면 빈 상태, '빠르게 여행 만들기'가 시트를 열어요", () => {
    useTrips.mockReturnValue({ trips: [], activeTrips: [], isReady: true });
    automation({ uiState: "off" });
    render(<AgentHubContent />);
    expect(screen.getByText("여행을 만들면 가계부가 시작돼요")).toBeTruthy();
    expect(screen.queryByTestId("automation-pill")).toBeNull();
    expect(screen.queryByText("확인 필요")).toBeNull();
    expect(
      screen.getByRole("link", { name: "AI로 일정까지 계획하기" }).getAttribute("href")
    ).toBe("/onboarding");
    // 자동 기록이 꺼져 있으면 연결 안내 한 줄만
    expect(screen.getByRole("link", { name: "연결하기" }).getAttribute("href")).toBe(
      "/onboarding/automation"
    );
    fireEvent.click(screen.getByRole("button", { name: "빠르게 여행 만들기" }));
    expect(screen.getByTestId("quick-trip-sheet")).toBeTruthy();
  });

  it("진행 중 여행의 합계·최근 지출·정산 요약을 한 화면에 보여요", async () => {
    render(<AgentHubContent />);
    await totalShown();
    expect(screen.getByRole("heading", { name: "도쿄" })).toBeTruthy();
    expect(screen.getByTestId("automation-pill").textContent).toBe("자동 기록 켜짐");
    expect(screen.getByRole("link", { name: "영수증 촬영" }).getAttribute("href")).toBe(
      "/trips/t-tokyo/ledger?add=receipt"
    );
    expect(await screen.findByText("야키토리")).toBeTruthy();
    expect(await screen.findByRole("link", { name: "정산 보기" })).toBeTruthy();
    expect(screen.queryByText("확인 필요")).toBeNull();
    // 허브에는 예전 자동 기록 배너/카드가 중복으로 없어요 (헤더 알약으로 대체)
    expect(screen.queryByText(/카드 알림 자동 기록이 켜져 있어요/)).toBeNull();
    expect(screen.queryByText(/자동 기록 꺼짐 · 연결하면/)).toBeNull();
  });

  it("알약은 로딩·에러에서 숨겨요", async () => {
    automation({ loading: true });
    const { rerender } = render(<AgentHubContent />);
    await totalShown();
    expect(screen.queryByTestId("automation-pill")).toBeNull();
    automation({ uiState: null, error: { message: "x" } });
    rerender(<AgentHubContent />);
    expect(screen.queryByTestId("automation-pill")).toBeNull();
  });

  it("여행 바꾸기: 헤더·최근 지출·정산 요약이 바뀌고 선택이 저장돼요", async () => {
    render(<AgentHubContent />);
    await totalShown();
    fireEvent.click(screen.getByRole("button", { name: /여행 바꾸기/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /오사카/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "오사카" })).toBeTruthy();
    expect(await screen.findByText("아직 지출이 없어요")).toBeTruthy();
    expect(
      await screen.findByText("정산할 내역이 생기면 여기서 보여줘요")
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "영수증 촬영" }).getAttribute("href")).toBe(
      "/trips/t-osaka/ledger?add=receipt"
    );
    expect(window.localStorage.getItem(STORAGE_KEYS.ledgerSelectedTrip)).toBe(OSAKA.id);
  });

  it("마지막 선택을 복원해요", async () => {
    window.localStorage.setItem(STORAGE_KEYS.ledgerSelectedTrip, OSAKA.id);
    render(<AgentHubContent />);
    expect(await screen.findByRole("heading", { name: "오사카" })).toBeTruthy();
  });

  it("여행이 1개뿐이면 '여행 바꾸기'가 없어요", async () => {
    useTrips.mockReturnValue({ trips: [TOKYO], activeTrips: [TOKYO], isReady: true });
    render(<AgentHubContent />);
    await totalShown();
    expect(screen.queryByRole("button", { name: /여행 바꾸기/ })).toBeNull();
  });

  it("지출 섹션만 실패해도 나머지는 보이고 다시 시도하면 불러와요", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    listExpenses.mockRejectedValueOnce(new Error("boom"));
    render(<AgentHubContent />);
    expect(await screen.findByRole("heading", { name: "도쿄" })).toBeTruthy();
    const retries = await screen.findAllByRole("button", { name: "다시 시도" });
    expect(retries.length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: "정산 보기" })).toBeTruthy();
    fireEvent.click(retries[0]!);
    await totalShown();
  });

  it("확인 필요: 제안이 있으면 붙이기 한 번으로 assign 만 호출해요", async () => {
    getBrowserSupabase.mockReturnValue(supabaseWithPending(1));
    automation({
      data: {
        unassignedCount: 1,
        recentEvents: [makeEvent({ id: "ev1", createdAt: "2026-07-21T03:00:00Z" })],
      },
    });
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AgentHubContent />);
    expect((await screen.findByTestId("needs-review-count")).textContent).toBe("2건");
    fireEvent.click(await screen.findByRole("button", { name: "도쿄 여행에 붙이기" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/events/ev1/assign",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("확인 필요: 제안 정보가 없으면 붙이기 버튼 없이 수신함 링크만", async () => {
    automation({
      data: {
        unassignedCount: 1,
        recentEvents: [makeEvent({ id: "ev2", createdAt: "2026-09-11T03:00:00Z" })],
      },
    });
    render(<AgentHubContent />);
    expect((await screen.findByTestId("needs-review-count")).textContent).toBe("1건");
    expect(screen.queryByRole("button", { name: /붙이기/ })).toBeNull();
    expect(screen.getByRole("link", { name: "수신함에서 정리하기" })).toBeTruthy();
  });

  it("더보기: 열고 닫으면 포커스가 버튼으로 돌아오고 링크가 도달 가능해요", async () => {
    automation({ data: { unassignedCount: 2, recentEvents: [] } });
    render(<AgentHubContent />);
    await totalShown();
    const more = screen.getByRole("button", { name: "더보기" });
    expect(more.className).toContain("h-11");
    expect(more.className).toContain("w-11");
    fireEvent.click(more);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("link")).toHaveLength(8);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it("데모 패널은 맨 아래에 있어요", async () => {
    render(<AgentHubContent />);
    await totalShown();
    const demo = screen.getByTestId("demo-panel");
    const settle = screen.getByLabelText("정산 요약");
    expect(
      settle.compareDocumentPosition(demo) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
