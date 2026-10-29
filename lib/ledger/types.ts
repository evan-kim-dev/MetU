export type LedgerCategory =
  | "식비"
  | "교통"
  | "숙소"
  | "관광"
  | "쇼핑"
  | "기타";

export type SplitType = "equal" | "fixed" | "ratio" | "custom";
export type PaymentMethod = "card" | "cash" | "transfer";
export type ExpenseSource = "receipt" | "sms" | "manual" | "voice";
export type FxSource = "auto_daily" | "cash_manual";
export type MemberRole = "owner" | "member";

export interface TripMember {
  id: string;
  tripId: string;
  displayName: string;
  isOwner: boolean;
  role?: MemberRole;
  userId?: string | null;
}

export interface LedgerItem {
  name: string;
  nameKo?: string | null;
  qty?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
}

/** Step 5-C / L-7 호환 앱 타입. merchant 가 있으면 label 로도 노출. */
export interface LedgerExpenseRow {
  id: string;
  tripId: string;
  paidBy: string;
  label: string;
  merchant?: string;
  merchantKo?: string | null;
  category: string;
  amount: number;
  currency: string;
  fxRateToKrw: number;
  fxRate?: number;
  fxRateDate?: string | null;
  fxSource?: FxSource;
  fxIsFallback?: boolean;
  feeRate?: number;
  feeFlatKrw?: number;
  krwBase?: number;
  feeKrw?: number;
  krwAmount: number;
  paymentMethod?: PaymentMethod;
  cardProfileId?: string | null;
  cardLabel?: string | null;
  source?: ExpenseSource;
  placeId?: string;
  spentOn?: string;
  paidAt?: string | null;
  dayIndex?: number;
  splitType: SplitType;
  shares: Record<string, number>;
  inputValues?: Record<string, number | null>;
  items?: LedgerItem[];
  note?: string | null;
  dedupeHash?: string | null;
}

export interface ExpenseRowDb {
  id: string;
  trip_id: string;
  created_by?: string | null;
  paid_by: string;
  label?: string | null;
  merchant?: string | null;
  merchant_ko?: string | null;
  category: string;
  amount: number | string;
  currency: string;
  payment_method?: string | null;
  card_profile_id?: string | null;
  card_label?: string | null;
  fx_rate_to_krw?: number | string | null;
  fx_rate?: number | string | null;
  fx_rate_date?: string | null;
  fx_source?: string | null;
  fx_is_fallback?: boolean | null;
  fee_rate?: number | string | null;
  fee_flat_krw?: number | null;
  krw_base?: number | string | null;
  fee_krw?: number | string | null;
  krw_amount: number | string;
  source?: string | null;
  raw_input?: unknown;
  items?: unknown;
  place_id?: string | null;
  spent_on?: string | null;
  paid_at?: string | null;
  day_index?: number | null;
  split_type: string;
  dedupe_hash?: string | null;
  note?: string | null;
}

export interface ShareRowDb {
  expense_id: string;
  member_id: string;
  trip_id?: string | null;
  input_value?: number | string | null;
  share_krw: number | string;
}

export interface ParsedExpense {
  label: string;
  amount: number;
  currency: string;
  paidByMemberId: string | null;
  participantIds: string[] | null;
  category: LedgerCategory;
  placeId: string | null;
  spentOn: string | null;
  confidence: number;
}

function num(v: number | string | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function rowToExpense(
  row: ExpenseRowDb,
  shareRows: ShareRowDb[] = []
): LedgerExpenseRow {
  const shares: Record<string, number> = {};
  const inputValues: Record<string, number | null> = {};
  for (const s of shareRows) {
    shares[s.member_id] = num(s.share_krw);
    inputValues[s.member_id] =
      s.input_value == null ? null : num(s.input_value);
  }

  const merchant = (row.merchant ?? row.label ?? "").toString();
  const fx = num(row.fx_rate ?? row.fx_rate_to_krw, 1);
  const split = row.split_type as SplitType;

  return {
    id: row.id,
    tripId: row.trip_id,
    paidBy: row.paid_by,
    label: merchant || (row.label ?? ""),
    merchant,
    merchantKo: row.merchant_ko ?? null,
    category: row.category,
    amount: num(row.amount),
    currency: row.currency,
    fxRateToKrw: fx,
    fxRate: fx,
    fxRateDate: row.fx_rate_date ?? null,
    fxSource: (row.fx_source as FxSource | undefined) ?? "auto_daily",
    fxIsFallback: Boolean(row.fx_is_fallback),
    feeRate: num(row.fee_rate),
    feeFlatKrw: num(row.fee_flat_krw),
    krwBase: num(row.krw_base ?? row.krw_amount),
    feeKrw: num(row.fee_krw),
    krwAmount: num(row.krw_amount),
    paymentMethod: (row.payment_method as PaymentMethod | undefined) ?? "card",
    cardProfileId: row.card_profile_id ?? null,
    cardLabel: row.card_label ?? null,
    source: (row.source as ExpenseSource | undefined) ?? "manual",
    placeId: row.place_id ?? undefined,
    spentOn: row.spent_on ?? undefined,
    paidAt: row.paid_at ?? null,
    dayIndex: row.day_index ?? undefined,
    splitType: split,
    shares,
    inputValues,
    items: Array.isArray(row.items) ? (row.items as LedgerItem[]) : [],
    note: row.note ?? null,
    dedupeHash: row.dedupe_hash ?? null,
  };
}

export function expenseToInsert(
  tripId: string,
  draft: Partial<LedgerExpenseRow> & {
    paidBy: string;
    amount: number;
    currency: string;
    krwAmount: number;
    createdBy?: string;
  }
): Record<string, unknown> {
  const merchant = draft.merchant ?? draft.label ?? "";
  const fx = draft.fxRate ?? draft.fxRateToKrw ?? 1;
  const krwBase = draft.krwBase ?? draft.krwAmount;
  const feeKrw = draft.feeKrw ?? 0;

  return {
    trip_id: tripId,
    created_by: draft.createdBy ?? null,
    paid_by: draft.paidBy,
    label: merchant,
    merchant,
    merchant_ko: draft.merchantKo ?? null,
    category: draft.category ?? "기타",
    amount: draft.amount,
    currency: draft.currency,
    payment_method: draft.paymentMethod ?? "card",
    card_profile_id: draft.cardProfileId ?? null,
    card_label: draft.cardLabel ?? null,
    fx_rate_to_krw: fx,
    fx_rate: fx,
    fx_rate_date: draft.fxRateDate ?? null,
    fx_source: draft.fxSource ?? "auto_daily",
    fx_is_fallback: draft.fxIsFallback ?? false,
    fee_rate: draft.feeRate ?? 0,
    fee_flat_krw: draft.feeFlatKrw ?? 0,
    krw_base: krwBase,
    fee_krw: feeKrw,
    krw_amount: draft.krwAmount,
    source: draft.source ?? "manual",
    items: draft.items ?? [],
    place_id: draft.placeId ?? null,
    spent_on: draft.spentOn ?? null,
    paid_at: draft.paidAt ?? null,
    day_index: draft.dayIndex ?? null,
    split_type: draft.splitType === "custom" ? "fixed" : (draft.splitType ?? "equal"),
    dedupe_hash: draft.dedupeHash ?? null,
    note: draft.note ?? null,
  };
}
