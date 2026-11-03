"use client";

import { PayStep } from "@/components/ledger/journey/host/PayStep";

type Props = {
  tripId: string;
  /** 레거시 호환. PayStep 이 정산 유무를 직접 읽어요. */
  hasTransfers: boolean;
  onDone?: () => void;
};

/**
 * 게스트 ③ 송금. PayStep(audience=guest) — 나와 관련된 송금만, 내 건만 완료 표시.
 */
export function GuestPay({ tripId, onDone }: Props) {
  return (
    <PayStep
      tripId={tripId}
      mode="journey"
      audience="guest"
      onDone={onDone}
    />
  );
}
