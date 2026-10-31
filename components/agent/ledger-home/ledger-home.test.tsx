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

import { AGENT_REASON_MESSAGES } from "@/lib/agent/event-status";
import { STORAGE_KEYS } from "@/lib/constants";
import { totalKrw } from "@/lib/ledger/stats";
import { formatKRW } from "@/lib/shared/format";
import { MoreSheet } from "@/components/agent/ledger-home/MoreSheet";
import { NeedsReviewCard } from "@/components/agent/ledger-home/NeedsReviewCard";
import {
  pickFeaturedReview,
  reviewReasonLine,
  reviewSummaryLine,
} from "@/components/agent/ledger-home/needsReview";
import { PrimaryActions } from "@/components/agent/ledger-home/PrimaryActions";
import { RecentExpenses } from "@/components/agent/ledger-home/RecentExpenses";
import { SettlementSummaryCard } from "@/components/agent/ledger-home/SettlementSummaryCard";
import { TripHeaderCard } from "@/components/agent/ledger-home/TripHeaderCard";
import { TripSwitcherSheet } from "@/components/agent/ledger-home/TripSwitcherSheet";
import {
  pickDefaultTrip,
  useSelectedTrip,
} from "@/components/agent/ledger-home/useSelectedTrip";
import {
  EXPENSES,
  EXPENSES_TOTAL_KRW,
  MEMBERS,
  makeEvent,
  makeTrip,
  OSAKA,
  SETTLEMENT_OPEN,
  TOKYO,
} from "@/components/agent/ledger-home/ledger-home.fixtures";
import type { SectionState } from "@/components/agent/ledger-home/useLedgerHomeData";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const ready = <T,>(data: T): SectionState<T> => ({ status: "ready", data });
const loading: SectionState<never> = { status: "loading", data: null };
const failed: SectionState<never> = { status: "error", data: null };

describe("pickDefaultTrip", () => {
  it("진행 중 > 임박 > 최근 생성 순", () => {
    const recentUpcoming = makeTrip({ id: "a", status: "upcoming", startDate: "2026-12-01" });
    const soonUpcoming = makeTrip({ id: "b", status: "upcoming", startDate: "2026-09-01" });
    expect(pickDefaultTrip([recentUpcoming, soonUpcoming, TOKYO])?.id).toBe(TOKYO.id);
    expect(pickDefaultTrip([recentUpcoming, soonUpcoming])?.id).toBe("b");
    const undated = makeTrip({ id: "c", status: "upcoming" });
    expect(pickDefaultTrip([undated, makeTrip({ id: "d", status: "upcoming" })])?.id).toBe("c");
  });

  it("모두 완료면 첫 여행, 없으면 null", () => {
    const done = makeTrip({ id: "z", status: "completed" });
    expect(pickDefaultTrip([done])?.id).toBe("z");
    expect(pickDefaultTrip([])).toBeNull();
  });
});

function SelectedProbe({ trips }: { trips: ReturnType<typeof makeTrip>[] }) {
  const { selectedTrip, select, ready: isReady } = useSelectedTrip(trips, true);
  return (
    <div>
      <p data-testid="ready">{String(isReady)}</p>
      <p data-testid="sel">{selectedTrip?.destination ?? "none"}</p>
      <button type="button" onClick={() => select(OSAKA.id)}>
        오사카 고르기
      </button>
    </div>
  );
}

describe("useSelectedTrip", () => {
  it("기본값은 진행 중 여행이고, 선택하면 localStorage 에 저장돼요", async () => {
    render(<SelectedProbe trips={[OSAKA, TOKYO]} />);
    await waitFor(() => expect(screen.getByTestId("sel").textContent).toBe("도쿄"));
    fireEvent.click(screen.getByText("오사카 고르기"));
    expect(screen.getByTestId("sel").textContent).toBe("오사카");
    expect(window.localStorage.getItem(STORAGE_KEYS.ledgerSelectedTrip)).toBe(OSAKA.id);
  });

  it("저장된 선택을 복원하고, 없는 여행이면 기본값으로 돌아가요", async () => {
    window.localStorage.setItem(STORAGE_KEYS.ledgerSelectedTrip, OSAKA.id);
    const { unmount } = render(<SelectedProbe trips={[OSAKA, TOKYO]} />);
    await waitFor(() => expect(screen.getByTestId("sel").textContent).toBe("오사카"));
    unmount();
    window.localStorage.setItem(STORAGE_KEYS.ledgerSelectedTrip, "deleted-trip");
    render(<SelectedProbe trips={[OSAKA, TOKYO]} />);
    await waitFor(() => expect(screen.getByTestId("sel").textContent).toBe("도쿄"));
  });
});

describe("TripHeaderCard", () => {
  const base = {
    trip: TOKYO,
    onRetryExpenses: vi.fn(),
    canSwitch: true,
    onSwitch: vi.fn(),
  };

  it("원화 합계는 totalKrw(expenses) 와 같고 외화는 통화별 한 줄로 요약해요", () => {
    render(<TripHeaderCard {...base} expenses={ready(EXPENSES)} pill="ok" />);
    expect(totalKrw(EXPENSES)).toBe(EXPENSES_TOTAL_KRW);
    expect(screen.getByTestId("trip-total-krw").textContent).toBe(
      formatKRW(EXPENSES_TOTAL_KRW)
    );
    const toggle = screen.getByRole("button", { name: /JPY/ });
    expect(toggle.textContent).toBe("6,000 JPY");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const detail = screen.getByTestId("currency-totals");
    expect(detail.parentElement?.hasAttribute("hidden")).toBe(false);
  });

  it("외화가 없으면 통화 요약 줄이 없어요", () => {
    render(
      <TripHeaderCard {...base} expenses={ready(EXPENSES.slice(0, 3))} pill="ok" />
    );
    expect(screen.queryByRole("button", { name: /JPY/ })).toBeNull();
  });

  it("자동 기록 알약 4상태", () => {
    const labels = {
      ok: "자동 기록 켜짐",
      silent: "자동 기록 켜짐",
      unverified: "연결 확인 필요",
      off: "자동 기록 꺼짐 · 연결하기",
    } as const;
    for (const state of ["ok", "silent", "unverified", "off"] as const) {
      const { unmount } = render(
        <TripHeaderCard {...base} expenses={ready(EXPENSES)} pill={state} />
      );
      const pill = screen.getByTestId("automation-pill");
      expect(pill.textContent).toBe(labels[state]);
      expect(pill.getAttribute("href")).toBe("/onboarding/automation");
      expect(pill.className).toContain("min-h-tap");
      unmount();
    }
  });

  it("pill 이 null 이면 알약을 숨겨요 (게스트·로딩·에러)", () => {
    render(<TripHeaderCard {...base} expenses={ready(EXPENSES)} pill={null} />);
    expect(screen.queryByTestId("automation-pill")).toBeNull();
  });

  it("여행이 1개뿐이면 '여행 바꾸기'를 숨기고, 여러 개면 눌렀을 때 onSwitch 를 불러요", () => {
    const onSwitch = vi.fn();
    const { rerender } = render(
      <TripHeaderCard {...base} onSwitch={onSwitch} expenses={ready(EXPENSES)} pill={null} />
    );
    fireEvent.click(screen.getByRole("button", { name: /여행 바꾸기/ }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
    rerender(
      <TripHeaderCard {...base} canSwitch={false} expenses={ready(EXPENSES)} pill={null} />
    );
    expect(screen.queryByRole("button", { name: /여행 바꾸기/ })).toBeNull();
  });

  it("숫자 자리만 스켈레톤이고, 실패하면 섹션 안에서 다시 시도해요", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <TripHeaderCard {...base} expenses={loading} pill={null} />
    );
    expect(screen.getByText("도쿄")).toBeTruthy();
    expect(screen.queryByText(/₩/)).toBeNull();
    rerender(
      <TripHeaderCard {...base} onRetryExpenses={onRetry} expenses={failed} pill={null} />
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("도쿄")).toBeTruthy();
  });
});

describe("PrimaryActions", () => {
  it("영수증·직접 추가 링크와 터치 영역 클래스", () => {
    render(<PrimaryActions tripId="t-tokyo" />);
    const receipt = screen.getByRole("link", { name: "영수증 촬영" });
    const manual = screen.getByRole("link", { name: "직접 추가" });
    expect(receipt.getAttribute("href")).toBe("/trips/t-tokyo/ledger?add=receipt");
    expect(manual.getAttribute("href")).toBe("/trips/t-tokyo/ledger?add=manual");
    for (const el of [receipt, manual]) {
      expect(el.className).toMatch(/min-h-(tap|touch)/);
    }
    expect(receipt.className).toContain("bg-brand");
    expect(manual.className).not.toContain("bg-brand");
  });
});

describe("needsReview helpers", () => {
  const inWindow = makeEvent({ id: "ev-in", createdAt: "2026-07-21T03:00:00Z" });
  const osakaEvent = makeEvent({ id: "ev-osaka", createdAt: "2026-09-11T03:00:00Z" });
  const nowMs = Date.parse("2026-07-22T00:00:00Z");

  it("이 여행에 붙일 수 있는 미배정을 우선하고, 다른 여행 제안은 폴백으로만 써요", () => {
    const picked = pickFeaturedReview({
      events: [osakaEvent, inWindow],
      tripId: TOKYO.id,
      activeTrips: [TOKYO, OSAKA],
      nowMs,
    });
    expect(picked?.event.id).toBe("ev-in");
    expect(picked?.suggest?.tripId).toBe(TOKYO.id);

    const onlyOsaka = pickFeaturedReview({
      events: [osakaEvent],
      tripId: TOKYO.id,
      activeTrips: [TOKYO, OSAKA],
      nowMs,
    });
    expect(onlyOsaka?.event.id).toBe("ev-osaka");
    expect(onlyOsaka?.suggest).toBeNull();
  });

  it("활성 여행이 없으면 제안이 없어요", () => {
    const picked = pickFeaturedReview({
      events: [inWindow],
      tripId: TOKYO.id,
      activeTrips: [],
      nowMs,
    });
    expect(picked?.event.id).toBe("ev-in");
    expect(picked?.suggest).toBeNull();
  });

  it("연결 테스트·다른 여행 알림은 건너뛰어요", () => {
    expect(
      pickFeaturedReview({
        events: [
          makeEvent({ id: "t1", isTest: true }),
          makeEvent({ id: "t2", status: "needs_review", tripId: OSAKA.id }),
        ],
        tripId: TOKYO.id,
        activeTrips: [TOKYO, OSAKA],
      })
    ).toBeNull();
  });

  it("요약 줄은 가맹점·금액(원화/외화)이고, 사유는 사유 표를 그대로 써요", () => {
    expect(reviewSummaryLine(inWindow)).toBe("스타카페 · ₩4,500");
    expect(
      reviewSummaryLine(
        makeEvent({ id: "j", preview: { amount: 1200, currency: "JPY", merchant: null, confidence: 1, kind: "approval" } })
      )
    ).toBe("가맹점 미상 · 1,200 JPY");
    expect(reviewSummaryLine(makeEvent({ id: "n", preview: null, textPreview: "카드 승인 문자" }))).toBe(
      "카드 승인 문자"
    );
    expect(reviewSummaryLine(makeEvent({ id: "e", preview: null }))).toBe("자동 수집 알림");

    for (const [code, message] of Object.entries(AGENT_REASON_MESSAGES)) {
      if (code === "no-owner-member" || code === "commit-failed") {
        const line = reviewReasonLine({
          event: makeEvent({ id: code, status: "failed", reason: null, error: code }),
          suggest: null,
        });
        expect(line).toBe(message);
      }
    }
    expect(
      reviewReasonLine({
        event: makeEvent({ id: "u", status: "needs_review", reason: null, error: "??" }),
        suggest: null,
      })
    ).toBe("확인이 필요해요");
  });
});

describe("NeedsReviewCard", () => {
  const withSuggest = pickFeaturedReview({
    events: [makeEvent({ id: "ev-in", createdAt: "2026-07-21T03:00:00Z" })],
    tripId: TOKYO.id,
    activeTrips: [TOKYO],
    nowMs: Date.parse("2026-07-22T00:00:00Z"),
  });

  it("0건이면 카드가 없어요", () => {
    const { container } = render(
      <NeedsReviewCard count={0} featured={withSuggest} tripId={TOKYO.id} onAssigned={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("N건 배지, 제안이 있으면 붙이기 버튼이 assign 엔드포인트만 호출해요", async () => {
    const onAssigned = vi.fn();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <NeedsReviewCard count={3} featured={withSuggest} tripId={TOKYO.id} onAssigned={onAssigned} />
    );
    expect(screen.getByTestId("needs-review-count").textContent).toBe("3건");
    expect(screen.getByText("스타카페 · ₩4,500")).toBeTruthy();
    const button = screen.getByRole("button", { name: "도쿄 여행에 붙이기" });
    expect(button.className).toContain("min-h-tap");
    fireEvent.click(button);
    await waitFor(() => expect(onAssigned).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/agent/events/ev-in/assign");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ tripId: TOKYO.id });
    vi.unstubAllGlobals();
  });

  it("붙이기에 실패하면 안내만 보이고 onAssigned 는 부르지 않아요", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const onAssigned = vi.fn();
    render(
      <NeedsReviewCard count={1} featured={withSuggest} tripId={TOKYO.id} onAssigned={onAssigned} />
    );
    fireEvent.click(screen.getByRole("button", { name: "도쿄 여행에 붙이기" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(onAssigned).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("제안이 없으면 붙이기 버튼 없이 수신함 링크만 있어요", () => {
    const featured = {
      event: makeEvent({ id: "ev-osaka", createdAt: "2026-09-11T03:00:00Z" }),
      suggest: null,
    };
    render(
      <NeedsReviewCard count={2} featured={featured} tripId={TOKYO.id} onAssigned={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /붙이기/ })).toBeNull();
    expect(
      screen.getByRole("link", { name: "수신함에서 정리하기" }).getAttribute("href")
    ).toBe("/agent/inbox");
  });
});

describe("RecentExpenses", () => {
  const props = {
    tripId: TOKYO.id,
    members: ready(MEMBERS),
    onRetry: vi.fn(),
    automationOff: false,
  };

  it("최신 5건을 최근 것부터, 외화 행에만 환율 줄이 있어요", () => {
    render(<RecentExpenses {...props} expenses={ready(EXPENSES)} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    const names = rows.map((r) => within(r).getByText(/라멘집|기념품|야키토리|편의점|지하철|공항 커피/).textContent);
    expect(names).toEqual(["야키토리", "기념품", "라멘집", "편의점", "지하철"]);
    expect(screen.queryByText("공항 커피")).toBeNull();
    // 환율 줄은 외화 3건에만 (aria-label 이 "외화 …" 로 시작)
    expect(screen.getAllByRole("button", { name: /^외화/ })).toHaveLength(3);
    expect(within(rows[3]!).queryByRole("button", { name: /^외화/ })).toBeNull();
    expect(rows[0]!.textContent).toContain(formatKRW(27_300));
    expect(within(rows[0]!).getByText(/7\/22 · 가나/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "전체 보기" }).getAttribute("href")
    ).toBe("/trips/t-tokyo/ledger");
  });

  it("0건이면 빈 상태, 자동 기록이 꺼져 있으면 연결 링크가 있어요", () => {
    const { rerender } = render(<RecentExpenses {...props} expenses={ready([])} />);
    expect(screen.getByText("아직 지출이 없어요")).toBeTruthy();
    expect(screen.getByText("영수증을 찍거나 직접 추가해 보세요")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "카드 알림 연결하기" })).toBeNull();
    rerender(<RecentExpenses {...props} expenses={ready([])} automationOff />);
    expect(
      screen.getByRole("link", { name: "카드 알림 연결하기" }).getAttribute("href")
    ).toBe("/onboarding/automation");
  });

  it("로딩은 스켈레톤, 실패는 섹션 안에서 다시 시도", () => {
    const onRetry = vi.fn();
    const { container, rerender } = render(<RecentExpenses {...props} expenses={loading} />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    rerender(<RecentExpenses {...props} onRetry={onRetry} expenses={failed} />);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("SettlementSummaryCard", () => {
  const base = { tripId: TOKYO.id, onRetry: vi.fn() };

  it("정산 없음: 안내만, 지출 2건·멤버 2명 이상이면 정산하기", () => {
    const { rerender } = render(
      <SettlementSummaryCard {...base} settlement={ready(null)} expenseCount={1} memberCount={2} />
    );
    expect(screen.getByText("정산할 내역이 생기면 여기서 보여줘요")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    rerender(
      <SettlementSummaryCard {...base} settlement={ready(null)} expenseCount={2} memberCount={2} />
    );
    expect(
      screen.getByRole("link", { name: "정산하기" }).getAttribute("href")
    ).toBe("/trips/t-tokyo/ledger/settle");
    rerender(
      <SettlementSummaryCard {...base} settlement={ready(null)} expenseCount={5} memberCount={1} />
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("정산 있음: 상태 칩, 저장된 송금 개수·합, 정산 보기 링크", () => {
    render(
      <SettlementSummaryCard {...base} settlement={ready(SETTLEMENT_OPEN)} expenseCount={6} memberCount={2} />
    );
    expect(screen.getByText("진행 중")).toBeTruthy();
    expect(screen.getByText("2건")).toBeTruthy();
    expect(screen.getByText(formatKRW(20_000))).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "정산 보기" }).getAttribute("href")
    ).toBe("/trips/t-tokyo/ledger/settle");
  });

  it("상태 칩 문구: stale / completed", () => {
    const { rerender } = render(
      <SettlementSummaryCard
        {...base}
        settlement={ready({ ...SETTLEMENT_OPEN, status: "stale" })}
        expenseCount={6}
        memberCount={2}
      />
    );
    expect(screen.getByText("최신 아님")).toBeTruthy();
    rerender(
      <SettlementSummaryCard
        {...base}
        settlement={ready({ ...SETTLEMENT_OPEN, status: "completed" })}
        expenseCount={6}
        memberCount={2}
      />
    );
    expect(screen.getByText("완료")).toBeTruthy();
  });

  it("실패: 섹션 안에서 다시 시도", () => {
    const onRetry = vi.fn();
    render(
      <SettlementSummaryCard {...base} onRetry={onRetry} settlement={failed} expenseCount={0} memberCount={0} />
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("MoreSheet", () => {
  function Harness({ tripId }: { tripId: string | null }) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLButtonElement>(null);
    return (
      <div>
        <button ref={ref} type="button" onClick={() => setOpen(true)}>
          열기
        </button>
        <MoreSheet
          open={open}
          onClose={() => setOpen(false)}
          tripId={tripId}
          unassignedCount={4}
          returnFocusRef={ref}
        />
      </div>
    );
  }

  it("열기 → dialog, ESC·배경 탭으로 닫히고 포커스가 돌아와요", async () => {
    render(<Harness tripId="t1" />);
    const opener = screen.getByText("열기");
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).not.toBe("hidden");

    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("항목 8개 링크가 모두 올바른 곳을 가리켜요", () => {
    render(<Harness tripId="t1" />);
    fireEvent.click(screen.getByText("열기"));
    const hrefs = within(screen.getByRole("dialog"))
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/trips/t1/ledger",
      "/trips/t1/ledger?settings=fx",
      "/trips/t1/ledger?add=voice",
      "/trips/t1/ledger/report",
      "/share-target",
      "/agent/inbox",
      "/onboarding/automation",
      "/board",
    ]);
    for (const a of within(screen.getByRole("dialog")).getAllByRole("link")) {
      expect(a.className).toContain("min-h-tap");
    }
    expect(screen.getByLabelText("미배정 4건")).toBeTruthy();
  });

  it("여행이 없으면 여행 관련 항목을 숨기고 이유를 한 줄로 알려요", () => {
    render(<Harness tripId={null} />);
    fireEvent.click(screen.getByText("열기"));
    const hrefs = within(screen.getByRole("dialog"))
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/share-target", "/agent/inbox", "/onboarding/automation", "/board"]);
    expect(screen.getByText(/여행을 만들면/)).toBeTruthy();
  });
});

describe("TripSwitcherSheet", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("목록(이름·날짜·상태 칩)에서 고르면 onSelect 후 닫혀요, 새 여행 만들기는 onCreate", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const onCreate = vi.fn();
    render(
      <TripSwitcherSheet
        open
        onClose={onClose}
        trips={[TOKYO, OSAKA]}
        selectedId={TOKYO.id}
        onSelect={onSelect}
        onCreate={onCreate}
      />
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("여행 중")).toBeTruthy();
    expect(screen.getByText("예정")).toBeTruthy();
    const current = screen.getByRole("button", { name: /도쿄/ });
    expect(current.getAttribute("aria-current")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /오사카/ }));
    expect(onSelect).toHaveBeenCalledWith(OSAKA.id);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "새 여행 만들기" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("최대 12개까지만 보여요", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      makeTrip({ id: `m${i}`, destination: `여행${i}` })
    );
    render(
      <TripSwitcherSheet
        open
        onClose={vi.fn()}
        trips={many}
        selectedId="m0"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />
    );
    expect(
      within(screen.getByRole("dialog")).getAllByRole("listitem")
    ).toHaveLength(12);
  });
});

