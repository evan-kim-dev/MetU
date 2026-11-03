// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const chipProps = vi.fn();

vi.mock("@/components/ledger/SplitBatchBox", () => ({
  SplitBatchBox: () => <div>한 줄 분담</div>,
}));
vi.mock("@/components/ledger/GuestExpenseSlot", () => ({
  GuestExpenseSlot: ({ meId }: { meId: string }) => <div>슬롯 {meId}</div>,
}));
vi.mock("@/components/ledger/ExpenseChipSplit", () => ({
  ExpenseChipSplit: (p: {
    expense: { merchant: string };
    meId: string;
    isAnonymous: boolean;
    isOwner: boolean;
  }) => {
    chipProps(p);
    return <li>칩 {p.expense.merchant}</li>;
  },
}));

import { GuestAdjust } from "./GuestAdjust";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";

const members: TripMember[] = [
  { id: "m1", tripId: "t1", displayName: "호스트", isOwner: true, userId: "u1" },
  { id: "m2", tripId: "t1", displayName: "민수", isOwner: false, userId: "u2" },
];
const expenses = [
  { id: "e1", merchant: "이자카야", krwAmount: 30000 },
] as unknown as LedgerExpenseRow[];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GuestAdjust", () => {
  it("내 몫 도구 3가지를 보여 주고, 칩은 본인 전용으로 넘겨요", () => {
    render(
      <GuestAdjust
        tripId="t1"
        userId="u2"
        members={members}
        expenses={expenses}
        onChanged={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText("한 줄 분담")).toBeTruthy();
    expect(screen.getByText("슬롯 m2")).toBeTruthy();
    expect(screen.getByText("칩 이자카야")).toBeTruthy();
    expect(chipProps).toHaveBeenCalledWith(
      expect.objectContaining({ meId: "m2", isAnonymous: true, isOwner: false })
    );
  });

  it("지출이 없으면 빈 문구를 보여 줘요", () => {
    render(
      <GuestAdjust
        tripId="t1"
        userId="u2"
        members={members}
        expenses={[]}
        onChanged={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText("아직 지출이 없어요.")).toBeTruthy();
  });

  it("멤버가 아니면 안내만 보여 주고 내 몫으로 돌아갈 수 있어요", () => {
    const onBack = vi.fn();
    render(
      <GuestAdjust
        tripId="t1"
        userId="u9"
        members={members}
        expenses={expenses}
        onChanged={vi.fn()}
        onBack={onBack}
      />
    );
    expect(screen.getByText("아직 이 여행 멤버가 아니에요")).toBeTruthy();
    expect(screen.queryByText("한 줄 분담")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "내 몫으로" }));
    expect(onBack).toHaveBeenCalled();
  });
});
