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

  it("주 CTA 「지출 추가」와 보조 「다음: 정산하기」", () => {
    const h = renderStep();
    fireEvent.click(screen.getByRole("button", { name: "지출 추가" }));
    expect(h.onOpenAdd).toHaveBeenCalledWith("paste");
    fireEvent.click(screen.getByRole("button", { name: "다음: 정산하기" }));
    expect(h.onSettle).toHaveBeenCalledTimes(1);
  });

  it("총지출·건수와 최근순 목록(외화·결제자), 누르면 분담 단계로", () => {
    const h = renderStep({
      expenses: [
        exp({ id: "a", merchant: "카페", spentOn: "2026-07-20", krwAmount: 4500 }),
        exp({
          id: "b",
          merchant: "라멘",
          merchantKo: "라멘집",
          spentOn: "2026-07-21",
          currency: "JPY",
          amount: 1200,
          krwAmount: 11000,
          paidBy: "m2",
        }),
      ],
    });
    expect(screen.getByLabelText("총지출 ₩15,500")).toBeTruthy();
    expect(
      screen.getByText((t) => t.includes("지출 2건"))
    ).toBeTruthy();
    const list = screen.getByRole("heading", { name: "최근 지출" }).closest("section")!;
    const rows = within(list)
      .getAllByRole("button")
      .filter((el) => el.getAttribute("aria-label"));
    expect(rows[0]!.getAttribute("aria-label")).toContain("라멘집");
    expect(screen.getByText("07/21 · 1,200 JPY · 민수 결제")).toBeTruthy();
    fireEvent.click(rows[1]!);
    expect(h.onAdjust).toHaveBeenCalledTimes(1);
    expect(screen.getByText("지출 분석 보기")).toBeTruthy();
  });

  it("확인할 알림·제안이 있으면 인박스로 가는 링크를 보여 줘요", () => {
    renderStep({ inboxCount: 3 });
    const link = screen.getByRole("link", { name: /확인할 알림·제안/ });
    expect(link.getAttribute("href")).toBe("/trips/t1/ledger/inbox");
    expect(link.textContent).toContain("3건");
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
