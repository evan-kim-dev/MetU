import type { LedgerExpenseRow } from "@/lib/ledger/types";

export function spendByPlaceId(
  expenses: Array<{ placeId?: string | null; krwAmount: number }>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    if (!e.placeId) continue;
    out[e.placeId] = (out[e.placeId] ?? 0) + e.krwAmount;
  }
  return out;
}

export function spendByDay(
  expenses: Array<{ dayIndex?: number | null; krwAmount: number }>
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const e of expenses) {
    if (typeof e.dayIndex !== "number") continue;
    out[e.dayIndex] = (out[e.dayIndex] ?? 0) + e.krwAmount;
  }
  return out;
}

/** LedgerExpenseRow 호환 헬퍼 */
export function spendByPlaceFromLedger(
  expenses: LedgerExpenseRow[]
): Record<string, number> {
  return spendByPlaceId(expenses);
}
