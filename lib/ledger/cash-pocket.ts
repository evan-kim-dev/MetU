import type { LedgerExpenseRow } from "@/lib/ledger/types";

/** 인출·환전으로 보는 라벨 (작성 시점 휴리스틱. VERIFY: 카테고리 정식화는 후속). */
const INFLOW_LABEL = /인출|환전|atm|ＡＴＭ|현금\s*충전/i;

export type CashPocketLine = {
  id: string;
  kind: "in" | "out";
  label: string;
  currency: string;
  amount: number;
  krwAmount: number;
};

export type CashPocketSummary = {
  /** 통화별 외화 잔액 (정수·소수 혼합 가능 — 표시용) */
  byCurrency: Record<string, number>;
  /** 원화 환산 잔액 합 (정수 KRW) */
  krwBalance: number;
  lines: CashPocketLine[];
  inflowCount: number;
  outflowCount: number;
};

export function isCashInflow(expense: Pick<LedgerExpenseRow, "label" | "merchant">): boolean {
  const text = `${expense.merchant ?? ""} ${expense.label ?? ""}`;
  return INFLOW_LABEL.test(text);
}

/**
 * 현금 주머니: 인출·환전(+) − 현금 지출(−).
 * 카드/이체는 무시. 금액 계산은 서버가 저장한 amount/krwAmount 만 사용.
 */
export function computeCashPocket(
  expenses: ReadonlyArray<
    Pick<
      LedgerExpenseRow,
      | "id"
      | "label"
      | "merchant"
      | "amount"
      | "currency"
      | "krwAmount"
      | "paymentMethod"
    >
  >
): CashPocketSummary {
  const byCurrency: Record<string, number> = {};
  let krwBalance = 0;
  const lines: CashPocketLine[] = [];
  let inflowCount = 0;
  let outflowCount = 0;

  for (const e of expenses) {
    if (e.paymentMethod !== "cash") continue;
    const currency = (e.currency || "KRW").trim().toUpperCase() || "KRW";
    const amount = Number(e.amount) || 0;
    const krw = Math.trunc(Number(e.krwAmount) || 0);
    const inflow = isCashInflow(e);
    if (inflow) {
      byCurrency[currency] = (byCurrency[currency] ?? 0) + amount;
      krwBalance += krw;
      inflowCount += 1;
      lines.push({
        id: e.id,
        kind: "in",
        label: e.merchant || e.label || "인출",
        currency,
        amount,
        krwAmount: krw,
      });
    } else {
      byCurrency[currency] = (byCurrency[currency] ?? 0) - amount;
      krwBalance -= krw;
      outflowCount += 1;
      lines.push({
        id: e.id,
        kind: "out",
        label: e.merchant || e.label || "현금 지출",
        currency,
        amount,
        krwAmount: krw,
      });
    }
  }

  return {
    byCurrency,
    krwBalance,
    lines,
    inflowCount,
    outflowCount,
  };
}
