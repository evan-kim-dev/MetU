"use client";

import { useCallback, useEffect, useState } from "react";

import { ExpenseConfirmSheet } from "@/components/ledger/ExpenseConfirmSheet";
import {
  listPendingProposals,
  resolveProposal,
} from "@/lib/ledger/proposals-client";
import { proposalToDraft, type ProposalRow } from "@/lib/ledger/proposals";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type CardProfile = {
  id: string;
  label: string;
  fee_rate: number | null;
  fee_flat_krw: number;
};

type Props = {
  tripId: string;
  members: TripMember[];
  cardProfiles?: CardProfile[];
};

export function ProposalInbox({
  tripId,
  members,
  cardProfiles = [],
}: Props) {
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [active, setActive] = useState<ProposalRow | null>(null);
  const [savedExpenseId, setSavedExpenseId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setRows(await listPendingProposals(supabase, tripId));
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function approveResolve(proposalId: string, expenseId: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    const result = await resolveProposal(supabase, {
      id: proposalId,
      decision: "approved",
      expenseId,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      setSavedExpenseId(expenseId);
      return;
    }
    setActive(null);
    setSavedExpenseId(null);
    setMessage(null);
    await reload();
  }

  async function reject(proposalId: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    const result = await resolveProposal(supabase, {
      id: proposalId,
      decision: "rejected",
      reason: reason.trim() || null,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setRejectId(null);
    setReason("");
    await reload();
  }

  if (rows.length === 0 && !active) return null;

  const nameOf = (memberId: string) =>
    members.find((m) => m.id === memberId)?.displayName ?? "게스트";

  return (
    <section
      aria-label="게스트 제안"
      className="rounded-2xl bg-mu-card p-4 shadow-sm"
    >
      <h2 className="text-sm font-extrabold text-mu-fg">게스트 제안</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((p) => (
          <li
            key={p.id}
            className="rounded-xl bg-mu-sunken px-3 py-3 text-xs"
          >
            <p className="font-bold text-mu-fg">
              {nameOf(p.proposerMemberId)} · {p.label}
            </p>
            <p className="mt-1 text-mu-fg-2">
              {p.amount} {p.currency}
              {p.source === "receipt" ? " · 영수증으로 채움" : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-[44px] rounded-lg bg-mu-accent px-3 font-bold text-white"
                onClick={() => {
                  setSavedExpenseId(null);
                  setActive(p);
                }}
              >
                승인
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-lg border border-mu-line px-3 font-bold text-mu-fg"
                onClick={() => setRejectId(p.id)}
              >
                거절
              </button>
            </div>
            {rejectId === p.id ? (
              <div className="mt-2 flex flex-col gap-2">
                <input
                  className="min-h-[44px] rounded-lg border border-mu-line px-3"
                  placeholder="사유 (선택)"
                  maxLength={100}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-[44px] rounded-lg bg-mu-fg font-bold text-white"
                  onClick={() => void reject(p.id)}
                >
                  거절 확정
                </button>
              </div>
            ) : null}
            {savedExpenseId && active?.id === p.id ? (
              <button
                type="button"
                disabled={busy}
                className="mt-2 min-h-[44px] font-bold text-mu-accent underline"
                onClick={() => void approveResolve(p.id, savedExpenseId)}
              >
                승인 처리를 다시 시도
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {message ? (
        <p role="status" className="mt-2 text-xs text-mu-fg-3">
          {message}
        </p>
      ) : null}

      {active ? (
        <ExpenseConfirmSheet
          tripId={tripId}
          members={members}
          drafts={[proposalToDraft(active, members)]}
          index={0}
          onIndexChange={() => undefined}
          onClose={() => setActive(null)}
          cardProfiles={cardProfiles}
          onSaved={(row?: LedgerExpenseRow) => {
            if (!row?.id) {
              setMessage("저장은 됐는지 확인해 주세요.");
              return;
            }
            setSavedExpenseId(row.id);
            void approveResolve(active.id, row.id);
          }}
        />
      ) : null}
    </section>
  );
}
