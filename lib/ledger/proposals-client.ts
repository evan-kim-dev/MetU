import type { SupabaseClient } from "@supabase/supabase-js";

import { TABLES } from "@/lib/constants";
import {
  ProposalInputSchema,
  TOO_MANY_PENDING_MESSAGE,
  type ProposalInput,
  type ProposalRow,
} from "@/lib/ledger/proposals";

type DbRow = {
  id: string;
  trip_id: string;
  proposed_by: string;
  proposer_member_id: string;
  label: string;
  amount: number | string;
  currency: string;
  category: string;
  spent_on: string | null;
  note: string | null;
  items: ProposalRow["items"] | null;
  source: "guest" | "receipt";
  status: ProposalRow["status"];
  reject_reason: string | null;
  resolved_expense_id: string | null;
  created_at: string;
};

function fromRow(row: DbRow): ProposalRow {
  return {
    id: row.id,
    tripId: row.trip_id,
    proposedBy: row.proposed_by,
    proposerMemberId: row.proposer_member_id,
    label: row.label,
    amount: Number(row.amount),
    currency: row.currency,
    category: row.category,
    spentOn: row.spent_on,
    note: row.note,
    items: Array.isArray(row.items) ? row.items : [],
    source: row.source,
    status: row.status,
    rejectReason: row.reject_reason,
    resolvedExpenseId: row.resolved_expense_id,
    createdAt: row.created_at,
  };
}

function mapError(message: string | undefined): string {
  if (!message) return "요청을 처리하지 못했어요.";
  if (message.includes("too-many-pending")) return TOO_MANY_PENDING_MESSAGE;
  if (message.includes("forbidden")) return "권한이 없어요.";
  if (message.includes("not-pending")) return "이미 처리된 제안이에요.";
  if (message.includes("not-found")) return "제안을 찾지 못했어요.";
  return "요청을 처리하지 못했어요.";
}

export async function createProposal(
  supabase: SupabaseClient,
  input: {
    tripId: string;
    proposerMemberId: string;
    draft: ProposalInput;
  }
): Promise<{ ok: true; row: ProposalRow } | { ok: false; error: string }> {
  const parsed = ProposalInputSchema.safeParse(input.draft);
  if (!parsed.success) {
    return { ok: false, error: "입력값을 확인해 주세요." };
  }
  const d = parsed.data;
  const { data, error } = await supabase
    .from(TABLES.tripExpenseProposals)
    .insert({
      trip_id: input.tripId,
      proposer_member_id: input.proposerMemberId,
      label: d.label,
      amount: d.amount,
      currency: d.currency,
      category: d.category,
      spent_on: d.spentOn ?? null,
      note: d.note ?? null,
      items: d.items ?? [],
      source: d.source,
      status: "pending",
    })
    .select(
      "id, trip_id, proposed_by, proposer_member_id, label, amount, currency, category, spent_on, note, items, source, status, reject_reason, resolved_expense_id, created_at"
    )
    .single();

  if (error || !data) {
    return { ok: false, error: mapError(error?.message) };
  }
  return { ok: true, row: fromRow(data as DbRow) };
}

export async function listMyProposals(
  supabase: SupabaseClient,
  tripId: string,
  userId: string
): Promise<ProposalRow[]> {
  const { data, error } = await supabase
    .from(TABLES.tripExpenseProposals)
    .select(
      "id, trip_id, proposed_by, proposer_member_id, label, amount, currency, category, spent_on, note, items, source, status, reject_reason, resolved_expense_id, created_at"
    )
    .eq("trip_id", tripId)
    .eq("proposed_by", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as DbRow[]).map(fromRow);
}

export async function listPendingProposals(
  supabase: SupabaseClient,
  tripId: string
): Promise<ProposalRow[]> {
  const { data, error } = await supabase
    .from(TABLES.tripExpenseProposals)
    .select(
      "id, trip_id, proposed_by, proposer_member_id, label, amount, currency, category, spent_on, note, items, source, status, reject_reason, resolved_expense_id, created_at"
    )
    .eq("trip_id", tripId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as DbRow[]).map(fromRow);
}

export async function countPendingProposals(
  supabase: SupabaseClient,
  tripId: string
): Promise<number> {
  const { count, error } = await supabase
    .from(TABLES.tripExpenseProposals)
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

export async function resolveProposal(
  supabase: SupabaseClient,
  input: {
    id: string;
    decision: "approved" | "rejected" | "withdrawn";
    expenseId?: string | null;
    reason?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("resolve_expense_proposal", {
    p_id: input.id,
    p_decision: input.decision,
    p_expense_id: input.expenseId ?? null,
    p_reason: input.reason ?? null,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  return { ok: true };
}
