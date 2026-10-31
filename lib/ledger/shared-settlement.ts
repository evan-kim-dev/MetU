import { z } from "zod";

/**
 * 공유 정산(/s/<토큰>) 상세 RPC `get_shared_settlement_detail` 응답 파서.
 * 응답은 외부 입력(DB JSON)이므로 zod 로 검증하고, 모르는 필드는 버린다.
 * 금액 계산은 하지 않는다 — 서버가 준 KRW 값을 그대로 보여 주고 합계만 대조한다.
 */

const MoneyNumber = z.coerce.number();

const MemberSchema = z.object({
  id: z.string(),
  displayName: z.string(),
});

const TransferSchema = z.object({
  from: z.string(),
  to: z.string(),
  krw: MoneyNumber,
  status: z.string(),
});

const ExpenseSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.string().nullish(),
  spentOn: z.string().nullish(),
  paidBy: z.string(),
  amount: MoneyNumber,
  currency: z.string(),
  fxRateToKrw: MoneyNumber.nullish(),
  krwAmount: MoneyNumber,
});

const DetailSchema = z.object({
  destination: z.string(),
  dateRange: z.string(),
  version: MoneyNumber,
  status: z.string(),
  completedAt: z.string().nullish(),
  settledAt: z.string().nullish(),
  members: z.array(MemberSchema),
  transfers: z.array(TransferSchema),
  totals: z.object({
    totalKrw: MoneyNumber,
    expenseCount: MoneyNumber.optional(),
    expensesTruncated: z.boolean().optional(),
  }),
  expenses: z.array(ExpenseSchema),
});

export type SharedSettlementExpense = {
  id: string;
  label: string;
  category: string;
  spentOn: string | null;
  paidBy: string;
  amount: number;
  currency: string;
  fxRateToKrw: number | null;
  krwAmount: number;
};

export type SharedSettlementDetail = {
  destination: string;
  dateRange: string;
  version: number;
  status: string;
  completedAt: string | null;
  settledAt: string | null;
  members: Array<{ id: string; displayName: string }>;
  transfers: Array<{ from: string; to: string; krw: number; status: string }>;
  totals: {
    totalKrw: number;
    expenseCount: number;
    expensesTruncated: boolean;
  };
  expenses: SharedSettlementExpense[];
};

/** 형식이 맞지 않으면 null (화면은 "링크가 유효하지 않아요"로 다룬다). */
export function parseSharedSettlementDetail(
  raw: unknown
): SharedSettlementDetail | null {
  const parsed = DetailSchema.safeParse(raw);
  if (!parsed.success) return null;
  const d = parsed.data;
  return {
    destination: d.destination,
    dateRange: d.dateRange,
    version: d.version,
    status: d.status,
    completedAt: d.completedAt ?? null,
    settledAt: d.settledAt ?? null,
    members: d.members,
    transfers: d.transfers,
    totals: {
      totalKrw: d.totals.totalKrw,
      expenseCount: d.totals.expenseCount ?? d.expenses.length,
      expensesTruncated: d.totals.expensesTruncated ?? false,
    },
    expenses: d.expenses.map((e) => ({
      id: e.id,
      label: e.label,
      category: e.category ?? "",
      spentOn: e.spentOn ?? null,
      paidBy: e.paidBy,
      amount: e.amount,
      currency: e.currency,
      fxRateToKrw: e.fxRateToKrw ?? null,
      krwAmount: e.krwAmount,
    })),
  };
}

export type ExpenseSumCheck =
  /** 보이는 지출의 원화 합계가 총액과 같다. */
  | { kind: "match"; sumKrw: number }
  /** 합계가 총액과 다르다 — 사용자에게 경고한다. */
  | { kind: "mismatch"; sumKrw: number; totalKrw: number }
  /** 지출이 많아 일부만 내려왔다 — 합계를 대조할 수 없다. */
  | { kind: "partial"; shown: number; total: number };

/** 지출 목록의 KRW 합계를 총액(totals.totalKrw)과 대조한다. */
export function checkExpenseSum(detail: SharedSettlementDetail): ExpenseSumCheck {
  if (
    detail.totals.expensesTruncated ||
    detail.totals.expenseCount > detail.expenses.length
  ) {
    return {
      kind: "partial",
      shown: detail.expenses.length,
      total: detail.totals.expenseCount,
    };
  }
  const sumKrw = detail.expenses.reduce((s, e) => s + e.krwAmount, 0);
  if (sumKrw === detail.totals.totalKrw) return { kind: "match", sumKrw };
  return { kind: "mismatch", sumKrw, totalKrw: detail.totals.totalKrw };
}
