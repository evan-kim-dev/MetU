"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  basisHash,
  computeBalances,
  minimizeTransfers,
  type LedgerExpense,
} from "@/lib/ledger/settle";
import { TABLES } from "@/lib/constants";
import { listExpenses, listMembers } from "@/lib/ledger/supabase";
import type { TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function LedgerSettlePage() {
  const { id: tripId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<LedgerExpense[]>([]);
  const [settlementId, setSettlementId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<
    Array<{
      id?: string;
      from: string;
      to: string;
      krw: number;
      status?: string;
    }>
  >([]);
  const [basis, setBasis] = useState<string>("");
  const [savedBasis, setSavedBasis] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<string>("");

  const reload = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const m = await listMembers(supabase, tripId);
    const e = await listExpenses(supabase, tripId);
    setMembers(m);
    setExpenses(
      e.map((row) => ({
        id: row.id,
        paidBy: row.paidBy,
        krwAmount: row.krwAmount,
        shares: row.shares,
      }))
    );
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const balances = useMemo(
    () => computeBalances(
      members.map((m) => m.id),
      expenses
    ),
    [members, expenses]
  );

  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.displayName ?? "?";

  async function createSettlement() {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    const hash = await basisHash(expenses);
    setBasis(hash);
    const transfersCalc = minimizeTransfers(balances);
    const { data, error } = await supabase.rpc("create_settlement", {
      p_trip_id: tripId,
      p_basis_hash: hash,
      p_transfers: transfersCalc.map((t) => ({
        from: t.from,
        to: t.to,
        krw: t.krw,
      })),
    });
    if (error || !data) {
      setMsg("정산 생성 실패 (소유자만 가능)");
      return;
    }
    setSettlementId(data as string);
    setSavedBasis(hash);
    setTransfers(transfersCalc);
    setStatus(transfersCalc.length === 0 ? "completed" : "open");
    setMsg("정산을 만들었어요.");

    const { data: rows } = await supabase
      .from(TABLES.tripSettlements)
      .select("share_token, status, basis_hash")
      .eq("id", data)
      .maybeSingle();
    if (rows) {
      setShareToken(rows.share_token as string);
      setStatus(rows.status as string);
      setSavedBasis(rows.basis_hash as string);
    }
  }

  async function markPaid(transferId: string | undefined, index: number) {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    if (transferId) {
      const { error } = await supabase.rpc("mark_transfer_paid", {
        p_transfer_id: transferId,
      });
      if (error) {
        setMsg("완료 처리 실패");
        return;
      }
    }
    setTransfers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, status: "paid" } : t))
    );
  }

  const stale = Boolean(basis && savedBasis && basis !== savedBasis);
  const allPaid =
    transfers.length > 0 && transfers.every((t) => t.status === "paid");

  useEffect(() => {
    void basisHash(expenses).then(setBasis);
  }, [expenses]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">정산</h1>
        <Link href={`/trips/${tripId}/ledger`} className="text-xs font-bold text-brand">
          가계부
        </Link>
      </div>

      <section className="rounded-xl bg-surface-soft p-3 text-xs">
        <p className="font-bold">잔액</p>
        <ul className="mt-2 space-y-1">
          {members.map((m) => (
            <li key={m.id} className="flex justify-between">
              <span>{m.displayName}</span>
              <span className="font-semibold">
                {formatKRW(balances[m.id] ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {stale ? (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          정산 후 지출이 바뀌었어요. 다시 계산할까요?
        </div>
      ) : null}

      <button
        type="button"
        className="rounded-xl bg-brand py-3 text-sm font-extrabold text-white"
        onClick={() => void createSettlement()}
      >
        정산 계산하기
      </button>

      {status === "completed" || allPaid ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
          정산 완료
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {transfers.map((t, i) => (
          <li
            key={`${t.from}-${t.to}-${i}`}
            className="flex items-center justify-between rounded-xl bg-surface-white p-3 text-sm shadow-sm"
          >
            <span>
              {nameOf(t.from)} → {nameOf(t.to)}{" "}
              <strong>{formatKRW(t.krw)}</strong>
            </span>
            {t.status === "paid" ? (
              <span className="text-xs font-bold text-emerald-700">완료</span>
            ) : (
              <button
                type="button"
                className="text-xs font-bold text-brand"
                onClick={() => void markPaid(t.id, i)}
              >
                송금 완료
              </button>
            )}
          </li>
        ))}
      </ul>

      {shareToken ? (
        <div className="rounded-xl bg-surface-soft p-3 text-xs">
          <p className="font-bold">공유 링크</p>
          <Link className="break-all text-brand" href={`/s/${shareToken}`}>
            /s/{shareToken}
          </Link>
        </div>
      ) : null}

      {msg ? <p className="text-xs text-ink-muted">{msg}</p> : null}
      {settlementId ? (
        <p className="text-[10px] text-ink-muted">id {settlementId}</p>
      ) : null}
    </div>
  );
}
