import {
  minimizeTransfers as settleMinimizeTransfers,
  type Transfer,
} from "@/lib/ledger/settle";
import type { Settlement, SettlementTransfer } from "@/lib/budget/types";

/**
 * 잔액(양수=받을 돈, 음수=낼 돈) → 송금 횟수 최소 정산안.
 * 계산은 lib/ledger/settle.ts 순수 함수에 위임한다.
 */
export function minimizeTransfers(
  balances: Record<string, number>
): SettlementTransfer[] {
  return settleMinimizeTransfers(balances).map((t: Transfer) => ({
    from: t.from,
    to: t.to,
    amount: t.krw,
  }));
}

export function buildSettlement(
  tripId: string,
  balances: Record<string, number>
): Settlement {
  return {
    tripId,
    transfers: minimizeTransfers(balances),
  };
}
