import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/constants";
import { dedupeHash } from "@/lib/ledger/dedupe";
import { computeKrw } from "@/lib/ledger/money";
import { computeShares, splitEqual } from "@/lib/ledger/settle";
import { parseSharedSettlementDetail } from "@/lib/ledger/shared-settlement";
import {
  expenseToInsert,
  rowToExpense,
  type ExpenseRowDb,
  type LedgerExpenseRow,
  type ShareRowDb,
  type SplitType,
  type TripMember,
} from "@/lib/ledger/types";

interface MemberRow {
  id: string;
  trip_id: string;
  display_name: string;
  is_owner: boolean;
  role?: string | null;
  user_id: string | null;
}

function memberFromRow(row: MemberRow): TripMember {
  const role =
    row.role === "owner" || row.is_owner
      ? ("owner" as const)
      : ("member" as const);
  return {
    id: row.id,
    tripId: row.trip_id,
    displayName: row.display_name,
    isOwner: role === "owner",
    role,
    userId: row.user_id,
  };
}

const MEMBER_COLS = "id, trip_id, display_name, is_owner, role, user_id";
const EXPENSE_COLS =
  "id, trip_id, created_by, paid_by, label, merchant, merchant_ko, category, amount, currency, payment_method, card_profile_id, card_label, fx_rate_to_krw, fx_rate, fx_rate_date, fx_source, fx_is_fallback, fee_rate, fee_flat_krw, krw_base, fee_krw, krw_amount, source, items, place_id, spent_on, paid_at, day_index, split_type, dedupe_hash, note";

export type LedgerSnapshot = {
  members: TripMember[];
  expenses: LedgerExpenseRow[];
};

export type ExpenseUpsertInput = {
  paidBy: string;
  label: string;
  category: string;
  amount: number;
  currency: string;
  fxRateToKrw: number;
  krwAmount: number;
  placeId?: string | null;
  spentOn?: string | null;
  dayIndex?: number | null;
  splitType: SplitType;
  shares?: Record<string, number>;
  createdBy?: string;
  feeRate?: number | null;
  feeFlatKrw?: number;
};

export async function listMembers(
  supabase: SupabaseClient,
  tripId: string
): Promise<TripMember[]> {
  const { data, error } = await supabase
    .from(TABLES.tripMembers)
    .select(MEMBER_COLS)
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((r) => memberFromRow(r as MemberRow));
}

export async function listExpenses(
  supabase: SupabaseClient,
  tripId: string
): Promise<LedgerExpenseRow[]> {
  const { data: expenseRows, error: expenseErr } = await supabase
    .from(TABLES.tripExpenses)
    .select(EXPENSE_COLS)
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (expenseErr) return [];

  const expenseIds = (expenseRows ?? []).map((e) => (e as ExpenseRowDb).id);
  let shareRows: ShareRowDb[] = [];
  if (expenseIds.length > 0) {
    const { data: shares, error: shareErr } = await supabase
      .from(TABLES.tripExpenseShares)
      .select("expense_id, member_id, trip_id, input_value, share_krw")
      .in("expense_id", expenseIds);
    if (shareErr) return [];
    shareRows = (shares ?? []) as ShareRowDb[];
  }

  const byExp = new Map<string, ShareRowDb[]>();
  for (const s of shareRows) {
    const list = byExp.get(s.expense_id) ?? [];
    list.push(s);
    byExp.set(s.expense_id, list);
  }

  return (expenseRows ?? []).map((row) =>
    rowToExpense(row as ExpenseRowDb, byExp.get((row as ExpenseRowDb).id) ?? [])
  );
}

/** 취소(void)된 지출 id. 정산 계산에서 제외해야 서버 자동 정산과 기준이 같다. 실패하면 null. */
export async function listVoidedExpenseIds(
  supabase: SupabaseClient,
  tripId: string
): Promise<Set<string> | null> {
  const { data, error } = await supabase
    .from(TABLES.tripExpenses)
    .select("id")
    .eq("trip_id", tripId)
    .eq("status", "voided");
  if (error) {
    console.error("[listVoidedExpenseIds]", error.message);
    return null;
  }
  return new Set((data ?? []).map((r) => String((r as { id: string }).id)));
}

export type SettlementStatus = "open" | "stale" | "completed" | "superseded";

export interface SettlementTransfer {
  id: string;
  from: string;
  to: string;
  krw: number;
  status: "pending" | "paid";
}

export interface SettlementSnapshot {
  id: string;
  version: number;
  status: SettlementStatus;
  origin: "manual" | "auto";
  basisHash: string;
  shareToken: string | null;
  transfers: SettlementTransfer[];
}

interface SettlementRowDb {
  id: string;
  version: number | string;
  status: string;
  origin?: string | null;
  basis_hash: string;
  share_token: string | null;
}

interface SettlementTransferRowDb {
  id: string;
  from_member: string;
  to_member: string;
  krw: number | string;
  status: string;
}

const SETTLEMENT_COLS = "id, version, status, origin, basis_hash, share_token";
const SETTLEMENT_TRANSFER_COLS = "id, from_member, to_member, krw, status";

/** DB 행 → 앱 타입. 결정적 순서(보내는 사람, 받는 사람, 금액)로 정렬한다. */
export function settlementFromRows(
  row: SettlementRowDb,
  transferRows: SettlementTransferRowDb[]
): SettlementSnapshot {
  const transfers: SettlementTransfer[] = transferRows
    .map((t) => ({
      id: t.id,
      from: t.from_member,
      to: t.to_member,
      krw: Number(t.krw),
      status: t.status === "paid" ? ("paid" as const) : ("pending" as const),
    }))
    .sort((a, b) => {
      if (a.from !== b.from) return a.from < b.from ? -1 : 1;
      if (a.to !== b.to) return a.to < b.to ? -1 : 1;
      return a.krw - b.krw;
    });

  return {
    id: row.id,
    version: Number(row.version),
    status: row.status as SettlementStatus,
    origin: row.origin === "auto" ? "auto" : "manual",
    basisHash: row.basis_hash,
    shareToken: row.share_token ?? null,
    transfers,
  };
}

export type LatestSettlementResult =
  | { ok: true; settlement: SettlementSnapshot | null }
  | { ok: false };

/**
 * 가장 최근(superseded 제외) 정산과 송금 목록을 읽는다. RLS: 여행 멤버만 조회 가능.
 * 자동 정산(origin='auto')도 같은 테이블이라 함께 읽힌다.
 */
export async function fetchLatestSettlement(
  supabase: SupabaseClient,
  tripId: string
): Promise<LatestSettlementResult> {
  const { data: row, error } = await supabase
    .from(TABLES.tripSettlements)
    .select(SETTLEMENT_COLS)
    .eq("trip_id", tripId)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[fetchLatestSettlement]", error.message);
    return { ok: false };
  }
  if (!row) return { ok: true, settlement: null };

  const settlementRow = row as SettlementRowDb;
  const { data: transferRows, error: transferErr } = await supabase
    .from(TABLES.tripSettlementTransfers)
    .select(SETTLEMENT_TRANSFER_COLS)
    .eq("settlement_id", settlementRow.id);
  if (transferErr) {
    console.error("[fetchLatestSettlement:transfers]", transferErr.message);
    return { ok: false };
  }

  return {
    ok: true,
    settlement: settlementFromRows(
      settlementRow,
      (transferRows ?? []) as SettlementTransferRowDb[]
    ),
  };
}

export interface SettlementHistoryItem {
  id: string;
  version: number;
  status: SettlementStatus;
  origin: "manual" | "auto";
  shareToken: string | null;
  createdAt: string | null;
}

interface SettlementHistoryRowDb {
  id: string;
  version: number | string;
  status: string;
  origin?: string | null;
  share_token: string | null;
  created_at?: string | null;
}

/**
 * 이 여행의 정산 버전 목록(최신 먼저, 최대 20개). 이전 버전의 공유 링크를 다시 보내는 데 쓴다.
 * RLS: 여행 멤버만 조회 가능. 실패하면 null.
 */
export async function fetchSettlementHistory(
  supabase: SupabaseClient,
  tripId: string
): Promise<SettlementHistoryItem[] | null> {
  const { data, error } = await supabase
    .from(TABLES.tripSettlements)
    .select("id, version, status, origin, share_token, created_at")
    .eq("trip_id", tripId)
    .order("version", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[fetchSettlementHistory]", error.message);
    return null;
  }
  return ((data ?? []) as SettlementHistoryRowDb[]).map((r) => ({
    id: r.id,
    version: Number(r.version),
    status: r.status as SettlementStatus,
    origin: r.origin === "auto" ? "auto" : "manual",
    shareToken: r.share_token ?? null,
    createdAt: r.created_at ?? null,
  }));
}

export async function fetchLedger(
  supabase: SupabaseClient,
  tripId: string
): Promise<LedgerSnapshot | null> {
  const members = await listMembers(supabase, tripId);
  const expenses = await listExpenses(supabase, tripId);
  // distinguish empty vs error: if both empty and trip inaccessible, members query still returns []
  const { error } = await supabase
    .from(TABLES.tripMembers)
    .select("id")
    .eq("trip_id", tripId)
    .limit(1);
  if (error) return null;
  return { members, expenses };
}

export async function ensureOwnerMember(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  displayName: string
): Promise<TripMember | null> {
  const { data: rpcId, error: rpcErr } = await supabase.rpc(
    "ensure_trip_owner_member",
    { p_trip_id: tripId }
  );
  if (!rpcErr && rpcId) {
    const members = await listMembers(supabase, tripId);
    return members.find((m) => m.id === rpcId) ?? members.find((m) => m.isOwner) ?? null;
  }

  const existing = await listMembers(supabase, tripId);
  if (existing.length > 0) {
    return existing.find((m) => m.isOwner) ?? existing[0]!;
  }

  const { data, error } = await supabase
    .from(TABLES.tripMembers)
    .insert({
      trip_id: tripId,
      display_name: displayName.slice(0, 30) || "나",
      user_id: userId,
      is_owner: true,
      role: "owner",
    })
    .select(MEMBER_COLS)
    .single();

  if (error || !data) return null;
  return memberFromRow(data as MemberRow);
}

export async function addTripMember(
  supabase: SupabaseClient,
  tripId: string,
  displayName: string
): Promise<TripMember | null> {
  const name = displayName.trim().slice(0, 30);
  if (!name) return null;

  const { data, error } = await supabase
    .from(TABLES.tripMembers)
    .insert({
      trip_id: tripId,
      display_name: name,
      is_owner: false,
      role: "member",
    })
    .select(MEMBER_COLS)
    .single();

  if (error || !data) return null;
  return memberFromRow(data as MemberRow);
}

export async function removeTripMember(
  supabase: SupabaseClient,
  memberId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.tripMembers)
    .delete()
    .eq("id", memberId);
  return !error;
}

function resolveShares(
  input: ExpenseUpsertInput,
  memberIds: string[]
): Record<string, number> {
  if (input.shares && (input.splitType === "custom" || input.splitType === "fixed" || input.splitType === "ratio")) {
    if (input.splitType === "custom" || input.splitType === "fixed") {
      // custom from Step 5 = already KRW shares
      if (input.splitType === "custom") return input.shares;
    }
  }
  if (input.splitType === "ratio" && input.shares) {
    const r = computeShares({
      type: "ratio",
      krwAmount: input.krwAmount,
      participants: memberIds,
      inputs: input.shares,
    });
    if (r.ok) return r.shares;
  }
  if (input.splitType === "fixed" && input.shares) {
    // treat as KRW fixed shares when coming from legacy custom UI
    return input.shares;
  }
  return splitEqual(input.krwAmount, memberIds);
}

export async function insertExpense(
  supabase: SupabaseClient,
  tripId: string,
  input: ExpenseUpsertInput,
  memberIds: string[]
): Promise<LedgerExpenseRow | null> {
  const shares = resolveShares(input, memberIds);
  const breakdown = computeKrw({
    amount: input.amount,
    fxRate: input.fxRateToKrw,
    feeRate: input.feeRate ?? 0,
    feeFlatKrw: input.feeFlatKrw ?? 0,
  });
  // Step 5 UI already passes krwAmount without fee — prefer that when fee unset
  const krwAmount =
    input.feeRate || input.feeFlatKrw
      ? breakdown.krwAmount
      : input.krwAmount;
  const krwBase =
    input.feeRate || input.feeFlatKrw ? breakdown.krwBase : input.krwAmount;
  const feeKrw =
    input.feeRate || input.feeFlatKrw ? breakdown.feeKrw : 0;

  const row = expenseToInsert(tripId, {
    paidBy: input.paidBy,
    label: input.label,
    merchant: input.label,
    category: input.category,
    amount: input.amount,
    currency: input.currency,
    fxRateToKrw: input.fxRateToKrw,
    fxRate: input.fxRateToKrw,
    krwBase,
    feeKrw,
    krwAmount,
    placeId: input.placeId ?? undefined,
    spentOn: input.spentOn ?? undefined,
    dayIndex: input.dayIndex ?? undefined,
    splitType: input.splitType === "custom" ? "fixed" : input.splitType,
    createdBy: input.createdBy,
    feeRate: input.feeRate ?? 0,
    feeFlatKrw: input.feeFlatKrw ?? 0,
    source: "manual",
  });

  const { data: expense, error: expErr } = await supabase
    .from(TABLES.tripExpenses)
    .insert(row)
    .select(EXPENSE_COLS)
    .single();

  if (expErr || !expense) return null;

  const shareRows = Object.entries(shares).map(([memberId, shareKrw]) => ({
    expense_id: expense.id,
    member_id: memberId,
    trip_id: tripId,
    share_krw: shareKrw,
  }));

  if (shareRows.length > 0) {
    const { error: shareErr } = await supabase
      .from(TABLES.tripExpenseShares)
      .insert(shareRows);
    if (shareErr) {
      await supabase.from(TABLES.tripExpenses).delete().eq("id", expense.id);
      return null;
    }
  }

  return rowToExpense(expense as ExpenseRowDb, shareRows as ShareRowDb[]);
}

export async function updateExpense(
  supabase: SupabaseClient,
  expenseId: string,
  input: ExpenseUpsertInput,
  memberIds: string[]
): Promise<LedgerExpenseRow | null> {
  const shares = resolveShares(input, memberIds);
  const merchant = input.label;

  const { data: expense, error: expErr } = await supabase
    .from(TABLES.tripExpenses)
    .update({
      paid_by: input.paidBy,
      label: merchant,
      merchant,
      category: input.category,
      amount: input.amount,
      currency: input.currency,
      fx_rate_to_krw: input.fxRateToKrw,
      fx_rate: input.fxRateToKrw,
      krw_base: input.krwAmount,
      fee_krw: 0,
      krw_amount: input.krwAmount,
      place_id: input.placeId ?? null,
      spent_on: input.spentOn ?? null,
      day_index: input.dayIndex ?? null,
      split_type: input.splitType === "custom" ? "fixed" : input.splitType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", expenseId)
    .select(EXPENSE_COLS)
    .single();

  if (expErr || !expense) return null;

  await supabase
    .from(TABLES.tripExpenseShares)
    .delete()
    .eq("expense_id", expenseId);

  const tripId = (expense as ExpenseRowDb).trip_id;
  const shareRows = Object.entries(shares).map(([memberId, shareKrw]) => ({
    expense_id: expenseId,
    member_id: memberId,
    trip_id: tripId,
    share_krw: shareKrw,
  }));

  if (shareRows.length > 0) {
    const { error: shareErr } = await supabase
      .from(TABLES.tripExpenseShares)
      .insert(shareRows);
    if (shareErr) return null;
  }

  return rowToExpense(expense as ExpenseRowDb, shareRows as ShareRowDb[]);
}

export type ExpenseDraft = {
  id?: string;
  tripId: string;
  paidBy: string;
  merchant: string;
  merchantKo?: string | null;
  category?: string;
  amount: number;
  currency: string;
  paymentMethod?: "card" | "cash" | "transfer";
  cardProfileId?: string | null;
  cardLabel?: string | null;
  fxRate: number;
  fxRateDate?: string | null;
  fxSource?: "auto_daily" | "cash_manual";
  fxIsFallback?: boolean;
  feeRate?: number | null;
  feeFlatKrw?: number;
  source?: "receipt" | "sms" | "manual" | "voice";
  rawInput?: unknown;
  items?: unknown[];
  placeId?: string | null;
  spentOn: string;
  paidAt?: string | null;
  splitType: "equal" | "fixed" | "ratio";
  participants: string[];
  inputs?: Record<string, number>;
  totalOriginal?: number;
  dedupeHash?: string | null;
  note?: string | null;
};

export async function saveExpense(
  supabase: SupabaseClient,
  draft: ExpenseDraft
): Promise<LedgerExpenseRow | null> {
  const breakdown = computeKrw({
    amount: draft.amount,
    fxRate: draft.fxRate,
    feeRate: draft.feeRate,
    feeFlatKrw: draft.feeFlatKrw,
  });
  const split = computeShares({
    type: draft.splitType,
    krwAmount: breakdown.krwAmount,
    participants: draft.participants,
    inputs: draft.inputs,
    totalOriginal: draft.totalOriginal,
    currency: draft.currency,
  });
  if (!split.ok) return null;

  const pExpense: Record<string, unknown> = {
    trip_id: draft.tripId,
    paid_by: draft.paidBy,
    merchant: draft.merchant,
    label: draft.merchant,
    merchant_ko: draft.merchantKo ?? null,
    category: draft.category ?? "기타",
    amount: draft.amount,
    currency: draft.currency,
    payment_method: draft.paymentMethod ?? "card",
    card_profile_id: draft.cardProfileId ?? null,
    card_label: draft.cardLabel ?? null,
    fx_rate: draft.fxRate,
    fx_rate_to_krw: draft.fxRate,
    fx_rate_date: draft.fxRateDate ?? null,
    fx_source: draft.fxSource ?? "auto_daily",
    fx_is_fallback: draft.fxIsFallback ?? false,
    fee_rate: draft.feeRate ?? 0,
    fee_flat_krw: draft.feeFlatKrw ?? 0,
    krw_base: breakdown.krwBase,
    fee_krw: breakdown.feeKrw,
    krw_amount: breakdown.krwAmount,
    source: draft.source ?? "manual",
    raw_input: draft.rawInput ?? null,
    items: draft.items ?? [],
    place_id: draft.placeId ?? null,
    spent_on: draft.spentOn,
    paid_at: draft.paidAt ?? null,
    split_type: draft.splitType,
    dedupe_hash:
      draft.dedupeHash ??
      dedupeHash({
        currency: draft.currency,
        amount: draft.amount,
        merchant: draft.merchant,
        spentOn: draft.spentOn,
      }),
    note: draft.note ?? null,
  };
  if (draft.id) pExpense.id = draft.id;

  const pShares = Object.entries(split.shares).map(([memberId, shareKrw]) => ({
    member_id: memberId,
    share_krw: shareKrw,
    input_value: draft.inputs?.[memberId] ?? null,
  }));

  const { data: id, error } = await supabase.rpc("save_trip_expense", {
    p_expense: pExpense,
    p_shares: pShares,
  });
  if (error || !id) return null;

  void syncTripSpent(supabase, draft.tripId);

  const expenses = await listExpenses(supabase, draft.tripId);
  return expenses.find((e) => e.id === id) ?? null;
}

export async function deleteLedgerExpense(
  supabase: SupabaseClient,
  expenseId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.tripExpenses)
    .delete()
    .eq("id", expenseId);
  return !error;
}

async function syncTripSpent(
  supabase: SupabaseClient,
  tripId: string
): Promise<void> {
  try {
    const expenses = await listExpenses(supabase, tripId);
    const total = expenses.reduce((s, e) => s + e.krwAmount, 0);
    await supabase
      .from(TABLES.trips)
      .update({ spent: total })
      .eq("id", tripId);
  } catch {
    // 지출 저장은 이미 성공 — spent 동기화 실패는 무시
  }
}

export async function listCardProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from(TABLES.ledgerCardProfiles)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function upsertCardProfile(
  supabase: SupabaseClient,
  profile: {
    id?: string;
    label: string;
    kind: "credit" | "debit" | "travel_prepaid" | "cash";
    feeRate?: number | null;
    feeFlatKrw?: number;
    note?: string | null;
    userId: string;
  }
) {
  const row = {
    id: profile.id,
    user_id: profile.userId,
    label: profile.label,
    kind: profile.kind,
    fee_rate: profile.feeRate ?? null,
    fee_flat_krw: profile.feeFlatKrw ?? 0,
    note: profile.note ?? null,
  };
  const { data, error } = await supabase
    .from(TABLES.ledgerCardProfiles)
    .upsert(row)
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function upsertCashRate(
  supabase: SupabaseClient,
  p: {
    tripId: string;
    memberId: string;
    currency: string;
    krwPerUnit: number;
    note?: string | null;
  }
) {
  const { data, error } = await supabase
    .from(TABLES.tripCashRates)
    .upsert({
      trip_id: p.tripId,
      member_id: p.memberId,
      currency: p.currency.toUpperCase(),
      krw_per_unit: p.krwPerUnit,
      note: p.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function fetchSharedLedger(
  supabase: SupabaseClient,
  token: string
): Promise<LedgerSnapshot | null> {
  // 1) 정산 공유 상세(이체 + 지출 내역). RPC 가 없거나 토큰이 아니면 다음 단계로.
  const detailRes = await supabase.rpc("get_shared_settlement_detail", {
    p_token: token,
  });
  if (!detailRes.error && detailRes.data) {
    const detail = parseSharedSettlementDetail(detailRes.data);
    if (detail) {
      const members: TripMember[] = detail.members.map((m) => ({
        id: m.id,
        tripId: "",
        displayName: m.displayName,
        isOwner: false,
      }));
      const expenses: LedgerExpenseRow[] = detail.expenses.map((e) => ({
        id: e.id,
        tripId: "",
        paidBy: e.paidBy,
        label: e.label,
        category: e.category,
        amount: e.amount,
        currency: e.currency,
        fxRateToKrw: e.fxRateToKrw ?? 1,
        krwAmount: e.krwAmount,
        spentOn: e.spentOn ?? undefined,
        splitType: "equal",
        shares: {},
      }));
      return { members, expenses };
    }
  }

  // 2) 상세 RPC 가 아직 없을 때: 멤버만 있는 기존 정산 공유.
  const settlement = await supabase.rpc("get_shared_settlement", {
    p_token: token,
  });
  if (!settlement.error && settlement.data) {
    const root = settlement.data as {
      members?: Array<{ id: string; displayName: string }>;
      transfers?: Array<{ from: string; to: string; krw: number; status: string }>;
      totals?: { totalKrw?: number };
    };
    const members: TripMember[] = (root.members ?? []).map((m) => ({
      id: m.id,
      tripId: "",
      displayName: m.displayName,
      isOwner: false,
    }));
    // Shared settlement view has transfers, not full expenses — keep empty expenses
    return { members, expenses: [] };
  }

  const { data, error } = await supabase.rpc("get_shared_ledger", {
    p_token: token,
  });

  if (error || data == null) return null;

  const root = data as {
    members?: Array<{
      id: string;
      displayName: string;
      isOwner: boolean;
    }>;
    expenses?: Array<{
      id: string;
      paidBy: string;
      label: string;
      category: string;
      amount: number;
      currency: string;
      fxRateToKrw: number;
      krwAmount: number;
      placeId?: string | null;
      spentOn?: string | null;
      dayIndex?: number | null;
      splitType: SplitType;
      shares?: Record<string, number>;
    }>;
  };

  const members: TripMember[] = (root.members ?? []).map((m) => ({
    id: m.id,
    tripId: "",
    displayName: m.displayName,
    isOwner: m.isOwner,
  }));

  const expenses: LedgerExpenseRow[] = (root.expenses ?? []).map((e) => ({
    id: e.id,
    tripId: "",
    paidBy: e.paidBy,
    label: e.label,
    category: e.category,
    amount: Number(e.amount),
    currency: e.currency,
    fxRateToKrw: Number(e.fxRateToKrw),
    krwAmount: Number(e.krwAmount),
    placeId: e.placeId ?? undefined,
    spentOn: e.spentOn ?? undefined,
    dayIndex: e.dayIndex ?? undefined,
    splitType: e.splitType,
    shares: e.shares ?? {},
  }));

  return { members, expenses };
}
