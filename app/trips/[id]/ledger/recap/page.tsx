"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { RecapCard } from "@/components/ledger/RecapCard";
import { buildTripRecap } from "@/lib/ledger/recap";
import { listExpenses, listMembers } from "@/lib/ledger/supabase";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function TripRecapPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<LedgerExpenseRow[]>([]);
  const [destination, setDestination] = useState<string>("");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    void (async () => {
      const [m, e, trip] = await Promise.all([
        listMembers(supabase, tripId),
        listExpenses(supabase, tripId),
        supabase
          .from("trips")
          .select("destination")
          .eq("id", tripId)
          .maybeSingle(),
      ]);
      setMembers(m);
      setExpenses(e);
      const dest = (trip.data as { destination?: string } | null)?.destination;
      if (dest) setDestination(dest);
    })();
  }, [tripId]);

  const recap = useMemo(
    () => buildTripRecap({ members, expenses }),
    [members, expenses]
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-6 print:max-w-none">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-extrabold">여행 리캡</h1>
        <div className="flex gap-3 text-xs font-bold">
          <Link href={`/trips/${tripId}/ledger`} className="text-mu-accent">
            가계부
          </Link>
          <Link href={`/trips/${tripId}/ledger/report`} className="text-mu-accent">
            리포트
          </Link>
          <button
            type="button"
            className="min-h-[44px] text-mu-fg-2"
            onClick={() => window.print()}
          >
            인쇄
          </button>
        </div>
      </div>
      <RecapCard destination={destination || undefined} recap={recap} />
      <p className="mt-4 text-[11px] text-mu-fg-3 print:hidden">
        저장된 지출만 모았어요. 없는 항목은 숨겼어요.
      </p>
    </div>
  );
}
