"use client";

import { useParams } from "next/navigation";
import { SettleStep } from "@/components/ledger/journey/host/SettleStep";

/** `/trips/[id]/ledger/settle` — 본문은 SettleStep (U4). */
export default function LedgerSettlePage() {
  const { id: tripId } = useParams<{ id: string }>();
  return <SettleStep tripId={tripId} mode="page" />;
}
