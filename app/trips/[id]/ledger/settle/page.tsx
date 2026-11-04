"use client";

import { useParams } from "next/navigation";
import { PayStep } from "@/components/ledger/journey/host/PayStep";
import { SettleStep } from "@/components/ledger/journey/host/SettleStep";
import { useSettleReference } from "@/components/ledger/useSettleReference";

/**
 * `/trips/[id]/ledger/settle` — 정산 생성(SettleStep) + 송금(PayStep).
 * 여정 `?step=` 에서는 단계별로 나뉘고, 이 URL 은 둘 다 보여 딥링크를 유지해요.
 */
export default function LedgerSettlePage() {
  const { id: tripId } = useParams<{ id: string }>();
  const reference = useSettleReference();
  return (
    <>
      <SettleStep tripId={tripId} mode="page" reference={reference} />
      <div className="mx-auto max-w-lg px-4 pb-28">
        <PayStep tripId={tripId} mode="page" reference={reference} />
      </div>
    </>
  );
}
