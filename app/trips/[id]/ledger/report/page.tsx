"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LedgerDashboard } from "@/components/ledger/LedgerDashboard";
import { listExpenses, listMembers } from "@/lib/ledger/supabase";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function LedgerReportPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<LedgerExpenseRow[]>([]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    void (async () => {
      setMembers(await listMembers(supabase, tripId));
      setExpenses(await listExpenses(supabase, tripId));
    })();
  }, [tripId]);

  const total = expenses.reduce((s, e) => s + e.krwAmount, 0);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 print:max-w-none">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-extrabold">여행 리포트</h1>
        <div className="flex gap-3 text-xs font-bold">
          <Link href={`/trips/${tripId}/ledger`} className="text-brand">
            가계부
          </Link>
          <button
            type="button"
            className="text-ink-body"
            onClick={() => window.print()}
          >
            인쇄
          </button>
        </div>
      </div>
      <LedgerDashboard
        expenses={expenses}
        members={members}
        budget={Math.max(total, 1)}
      />
      <p className="mt-4 text-[11px] text-ink-muted">
        환율은 일자별/현금/대체 출처가 지출 행에 저장돼요. 중앙값 근사치일 수
        있어요.
      </p>
    </div>
  );
}
