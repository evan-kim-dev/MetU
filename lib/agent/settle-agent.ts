/**
 * SettleAgent (순수): 잔액 → minimizeTransfers 정산안.
 * 스냅샷(trip_settlements)은 만들지 않는다 — Suggestion payload 전용.
 */
import { buildSettlement } from "@/lib/budget/engine/minimizeTransfers";
import type { Settlement, SettlementTransfer } from "@/lib/budget/types";

export type SettleProposal = {
  shouldSuggest: boolean;
  settlement: Settlement;
  message: string;
};

export function buildSettleProposal(args: {
  tripId: string;
  balances: Record<string, number>;
  basisHash?: string;
}): SettleProposal {
  const settlement = buildSettlement(args.tripId, args.balances);
  const transfers = settlement.transfers;
  if (transfers.length === 0) {
    return {
      shouldSuggest: false,
      settlement,
      message: "주고받을 금액이 없어요.",
    };
  }
  return {
    shouldSuggest: true,
    settlement,
    message: `송금 ${transfers.length}건으로 맞출 수 있어요. 확인 후 반영해요.`,
  };
}

/** Suggestion payload 에 넣을 전송 형태 (기존 settlement RPC 호환 krw) */
export function transfersForRpc(
  transfers: ReadonlyArray<SettlementTransfer>
): Array<{ from: string; to: string; krw: number }> {
  return transfers.map((t) => ({
    from: t.from,
    to: t.to,
    krw: t.amount,
  }));
}
