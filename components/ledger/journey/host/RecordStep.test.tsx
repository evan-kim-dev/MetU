// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { RecordStep } from "./RecordStep";

const members: TripMember[] = [
  { id: "m1", tripId: "t1", displayName: "가나", isOwner: true, userId: "u1" },
  { id: "m2", tripId: "t1", displayName: "민수", isOwner: false, userId: "u2" },
];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function exp(over: Partial<LedgerExpenseRow> & { id: string }): LedgerExpenseRow {
  return {
    tripId: "t1",
    paidBy: "m1",
    label: "점심",
    category: "식비",
    amount: 10000,
    currency: "KRW",
    fxRateToKrw: 1,
    krwAmount: 10000,
    splitType: "equal",
    shares: {},
    ...over,
  };
}

function renderStep(props: Partial<React.ComponentProps<typeof RecordStep>> = {}) {
  const handlers = {
    onOpenAdd: vi.fn(),
    onOpenIntent: vi.fn(),
    onAdjust: vi.fn(),
    onSettle: vi.fn(),
    onDismissCancel: vi.fn(),
  };
  render(
    <RecordStep
      tripId="t1"
      expenses={[]}
      members={members}
      inboxCount={0}
      cancelNotice={null}
      dashboard={<div>대시보드</div>}
      tripBudgetKrw={300_000}
      tripDays={3}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

afterEach(() => cleanup());

describe("RecordStep", () => {
  it("지출이 없으면 빈 상태, 「영수증 올리기」는 영수증 탭으로 시트를 열어요", () => {
    const h = renderStep();
    expect(screen.getByText("아직 기록이 없어요", { selector: "h3" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "영수증 올리기" }));
    expect(h.onOpenAdd).toHaveBeenCalledWith("receipt");
    expect(screen.queryByText("지출 분석 보기")).toBeNull();
  });

  it("주 CTA 「추가」는 의도 시트, 보조 「다음: 정산하기」", () => {
    const h = renderStep();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(h.onOpenIntent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "다음: 정산하기" }));
    expect(h.onSettle).toHaveBeenCalledTimes(1);
  });

  it("항공·숙소는 플랜 매칭 배지를 보여 줘요 (예상≠실제)", () => {
    const today = todayIso();
    renderStep({
      planAllocation: [{ id: "1", label: "숙소", amount: 400_000 }],
      expenses: [
        exp({
          id: "h1",
          category: "숙소",
          merchant: "호텔",
          krwAmount: 450_000,
          spentOn: today,
        }),
      ],
    });
    expect(screen.getByText(/숙소 예상/)).toBeTruthy();
    expect(screen.getByText(/플랜보다/)).toBeTruthy();
  });

  it("오늘 쓸 수 있는 돈과 오늘 지출 목록을 보여 줘요", () => {
    const today = todayIso();
    const h = renderStep({
      expenses: [
        exp({ id: "a", merchant: "카페", spentOn: today, krwAmount: 4500 }),
        exp({
          id: "b",
          merchant: "라멘",
          merchantKo: "라멘집",
          spentOn: today,
          currency: "JPY",
          amount: 1200,
          krwAmount: 11000,
          paidBy: "m2",
        }),
        exp({
          id: "old",
          merchant: "어제",
          spentOn: "2020-01-01",
          krwAmount: 99_000,
        }),
      ],
    });
    expect(screen.getByLabelText(/오늘 쓸 수 있는 돈/)).toBeTruthy();
    const list = screen.getByRole("heading", { name: "오늘 지출" }).closest("section")!;
    const rows = within(list)
      .getAllByRole("button")
      .filter((el) => el.getAttribute("aria-label"));
    expect(rows.some((r) => r.getAttribute("aria-label")?.includes("라멘집"))).toBe(
      true
    );
    expect(screen.queryByText("어제")).toBeNull();
    fireEvent.click(rows[0]!);
    expect(h.onAdjust).toHaveBeenCalled();
    expect(screen.getByText("지출 분석 보기")).toBeTruthy();
  });

  it("확인할 제안이 있으면 인박스 카드와 더보기를 보여 줘요", () => {
    renderStep({ inboxCount: 3 });
    expect(screen.getByText("에이전트 제안")).toBeTruthy();
    const more = screen.getByRole("link", { name: /제안 2개 더 보기/ });
    expect(more.getAttribute("href")).toBe("/trips/t1/ledger/inbox");
    expect(screen.getAllByRole("link", { name: "확인" })[0]!.getAttribute("href")).toBe(
      "/trips/t1/ledger/inbox"
    );
  });

  it("정산 줄은 onSettle 을 호출해요", () => {
    const h = renderStep();
    fireEvent.click(screen.getByRole("button", { name: "정산으로 이동" }));
    expect(h.onSettle).toHaveBeenCalledTimes(1);
  });

  it("취소 문자 안내를 닫을 수 있어요", () => {
    const h = renderStep({
      cancelNotice: {
        source: "sms",
        origin: "paste",
        merchant: "편의점",
        amount: 3000,
        currency: "KRW",
        spentOn: "2026-07-21",
        category: "기타",
        paymentMethod: "card",
        kind: "cancel",
      } as unknown as React.ComponentProps<typeof RecordStep>["cancelNotice"],
    });
    expect(screen.getByText("취소 문자예요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "취소 문자 안내 닫기" }));
    expect(h.onDismissCancel).toHaveBeenCalledTimes(1);
  });
});
