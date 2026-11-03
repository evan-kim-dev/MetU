"use client";

import { SplitBatchBox } from "@/components/ledger/SplitBatchBox";

type Props = {
  tripId: string;
  onChanged: () => void;
  /** 지출 목록 (ExpenseChipSplit) */
  expenseList: React.ReactNode;
};

/** 호스트 ④ 분담 단계. */
export function AdjustStep({ tripId, onChanged, expenseList }: Props) {
  return (
    <>
      <SplitBatchBox tripId={tripId} onChanged={onChanged} />
      {expenseList}
    </>
  );
}
