// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";

const chipProps = vi.fn();

vi.mock("@/components/ledger/SplitBatchBox", () => ({
  SplitBatchBox: ({ onChanged }: { onChanged: () => void }) => (
    <button type="button" onClick={onChanged}>
      여러 건 적용
    </button>
  ),
}));
vi.mock("@/components/ledger/SplitPatchBox", () => ({
  SplitPatchBox: ({ onChanged }: { onChanged: () => void }) => (
    <button type="button" onClick={onChanged}>
      한 건 적용
    </button>
  ),
}));
vi.mock("@/components/ledger/ExpenseChipSplit", () => ({
  ExpenseChipSplit: (p: {
    expense: { id: string; label: string };
    isOwner: boolean;
    isAnonymous: boolean;
    onChanged: () => void;
  }) => {
    chipProps(p);
    return (
      <li>
        <button type="button" onClick={p.onChanged}>
          칩 {p.expense.label}
        </button>
      </li>
    );
  },
}));

import { AdjustStep } from "./AdjustStep";

const members: TripMember[] = [
  { id: "m1", tripId: "t1", displayName: "가나", isOwner: true, userId: "u1" },
  { id: "m2", tripId: "t1", displayName: "민수", isOwner: false, userId: "u2" },
];
const expenses = [
  { id: "e1", label: "이자카야", krwAmount: 30000 },
  { id: "e2", label: "택시", krwAmount: 12000 },
] as unknown as LedgerExpenseRow[];

function renderStep(props: Partial<React.ComponentProps<typeof AdjustStep>> = {}) {
  const h = { onChanged: vi.fn(), onSettle: vi.fn(), onRecord: vi.fn() };
  render(
    <AdjustStep
      tripId="t1"
      expenses={expenses}
      members={members}
      meId="m1"
      isOwner
      isAnonymous={false}
      {...h}
      {...props}
    />
  );
  return h;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdjustStep", () => {
  it("한 줄(여러 건·한 건)과 지출별 칩을 함께 보여 주고, 칩엔 호스트 권한을 넘겨요", () => {
    renderStep();
    expect(screen.getByRole("heading", { name: "정산 전에 안 맞는 게 있나요?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "여러 건 적용" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "한 건 적용" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "칩 이자카야" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "칩 택시" })).toBeTruthy();
    expect(chipProps).toHaveBeenCalledWith(
      expect.objectContaining({ isOwner: true, isAnonymous: false })
    );
    expect(screen.getByText(/결제자도 여기서 바꿔요/)).toBeTruthy();
  });

  it("CTA 는 「문제없어요, 정산할게요」 하나, 누르면 정산 단계로", () => {
    const h = renderStep();
    const cta = screen.getByRole("button", { name: "문제없어요, 정산할게요" });
    fireEvent.click(cta);
    expect(h.onSettle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/분담을 \d+번 바꿨어요/)).toBeNull();
  });

  it("적용·되돌리기가 생기면 부모를 다시 읽게 하고 변경 횟수 힌트를 보여 줘요", () => {
    const h = renderStep();
    fireEvent.click(screen.getByRole("button", { name: "여러 건 적용" }));
    fireEvent.click(screen.getByRole("button", { name: "칩 택시" }));
    expect(h.onChanged).toHaveBeenCalledTimes(2);
    expect(screen.getByText("이번에 분담을 2번 바꿨어요. 정산에 반영돼요.")).toBeTruthy();
  });

  it("지출이 없으면 빈 상태와 「기록하러 가기」", () => {
    const h = renderStep({ expenses: [] });
    expect(screen.getByRole("heading", { name: "조정할 지출이 없어요" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "문제없어요, 정산할게요" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "기록하러 가기" }));
    expect(h.onRecord).toHaveBeenCalledTimes(1);
  });

  it("익명이면 칩에 익명 플래그를 넘기고 결제자 안내를 숨겨요 (최종 방어는 서버)", () => {
    renderStep({ isOwner: false, isAnonymous: true, meId: "m2" });
    expect(chipProps).toHaveBeenCalledWith(
      expect.objectContaining({ isOwner: false, isAnonymous: true })
    );
    expect(screen.queryByText(/결제자도 여기서 바꿔요/)).toBeNull();
  });
});
