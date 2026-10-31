"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  fetchLatestSettlement,
  listExpenses,
  listMembers,
  type SettlementSnapshot,
} from "@/lib/ledger/supabase";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export type SectionState<T> = {
  status: "loading" | "ready" | "error";
  data: T | null;
};

const LOADING = { status: "loading", data: null } as const;

/** LedgerShell 의 확인 필요 건수 쿼리와 같은 상태 집합 */
const PENDING_STATUSES = ["received", "processing", "needs_review", "failed"];

/** 섹션 하나를 독립적으로 읽는다. 실패해도 다른 섹션에는 영향이 없다. */
function useSection<T>(
  key: string | null,
  load: () => Promise<T>,
  label: string
) {
  const [state, setState] = useState<SectionState<T>>(LOADING);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!key) {
      setState(LOADING);
      return;
    }
    let cancelled = false;
    setState(LOADING);
    loadRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err: unknown) => {
        console.error(
          `[useLedgerHomeData:${label}]`,
          err instanceof Error ? err.message : err
        );
        if (!cancelled) setState({ status: "error", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key, nonce, label]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { state, retry };
}

function requireSupabase() {
  const supabase = getBrowserSupabase();
  if (!supabase) throw new Error("supabase-unavailable");
  return supabase;
}

/**
 * 선택한 여행 기준으로 지출·멤버·최신 정산·확인 필요 건수를 읽는다.
 * 기존 함수(listExpenses / listMembers / fetchLatestSettlement)와
 * LedgerShell 과 같은 agent_events 건수 쿼리만 쓴다. 새 API·새 쿼리 없음.
 */
export function useLedgerHomeData(tripId: string | null) {
  const { user, provider } = useAuth();
  const userId = user?.id ?? null;
  const enabled = Boolean(tripId && userId && provider !== "guest");
  const key = enabled ? `${tripId}:${userId}` : null;

  const expenses = useSection<LedgerExpenseRow[]>(
    key,
    () => listExpenses(requireSupabase(), tripId!),
    "expenses"
  );
  const members = useSection<TripMember[]>(
    key,
    () => listMembers(requireSupabase(), tripId!),
    "members"
  );
  const settlement = useSection<SettlementSnapshot | null>(
    key,
    async () => {
      const res = await fetchLatestSettlement(requireSupabase(), tripId!);
      if (!res.ok) throw new Error("settlement-failed");
      return res.settlement;
    },
    "settlement"
  );
  const pending = useSection<number>(
    key,
    async () => {
      const res = await requireSupabase()
        .from("agent_events")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId!)
        .eq("user_id", userId!)
        .in("status", PENDING_STATUSES);
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },
    "pending"
  );

  const { retry: retryExpenseRows } = expenses;
  const { retry: retryMemberRows } = members;
  const retryExpenses = useCallback(() => {
    retryExpenseRows();
    retryMemberRows();
  }, [retryExpenseRows, retryMemberRows]);

  return {
    enabled,
    expenses: expenses.state,
    members: members.state,
    settlement: settlement.state,
    pending: pending.state,
    retryExpenses,
    retrySettlement: settlement.retry,
    reloadPending: pending.retry,
  };
}
