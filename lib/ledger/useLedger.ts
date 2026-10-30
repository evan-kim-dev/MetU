"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFxRateToKrw } from "@/lib/ledger/fx";
import { spendByPlaceFromLedger } from "@/lib/ledger/spend-by-place";
import {
  addTripMember,
  deleteLedgerExpense,
  ensureOwnerMember,
  fetchLedger,
  insertExpense,
  removeTripMember,
  updateExpense,
  type ExpenseUpsertInput,
} from "@/lib/ledger/supabase";
import {
  computeBalances,
  minimizeTransfers,
  splitEqual,
  toKrw,
  type LedgerExpense,
} from "@/lib/ledger/settle";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { resolveFxTarget } from "@/lib/fx/currencies";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { TripDaySchedule } from "@/lib/trips/types";

export function useLedger(
  tripId: string,
  options?: {
    country?: string;
    destination?: string;
    dailySchedule?: TripDaySchedule[];
    onTotalKrwChange?: (totalKrw: number) => void;
  }
) {
  const { user, provider } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<LedgerExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user || provider === "guest") {
      setLoading(false);
      return;
    }

    setError("");
    let snap = await fetchLedger(supabase, tripId);
    if (!snap) {
      setError("가계부를 불러오지 못했어요.");
      setLoading(false);
      return;
    }

    if (snap.members.length === 0) {
      const owner = await ensureOwnerMember(
        supabase,
        tripId,
        user.id,
        user.user_metadata?.name?.trim() ||
          user.user_metadata?.nickname?.trim() ||
          "나"
      );
      if (owner) {
        snap = await fetchLedger(supabase, tripId);
      }
    }

    if (snap) {
      setMembers(snap.members);
      setExpenses(snap.expenses);
    }
    setLoading(false);
  }, [tripId, user, provider]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalKrw = useMemo(
    () => expenses.reduce((sum, e) => sum + e.krwAmount, 0),
    [expenses]
  );

  useEffect(() => {
    options?.onTotalKrwChange?.(totalKrw);
  }, [totalKrw, options]);

  const spendByPlaceId = useMemo(
    () => spendByPlaceFromLedger(expenses),
    [expenses]
  );

  const memberIds = useMemo(() => members.map((m) => m.id), [members]);

  const settlement = useMemo(() => {
    const ledgerExpenses: LedgerExpense[] = expenses.map((e) => ({
      id: e.id,
      paidBy: e.paidBy,
      krwAmount: e.krwAmount,
      shares: e.shares,
    }));
    const balances = computeBalances(memberIds, ledgerExpenses);
    const transfers = minimizeTransfers(balances);
    return { balances, transfers };
  }, [expenses, memberIds]);

  const defaultCurrency = useMemo(
    () =>
      resolveFxTarget(options?.country, options?.destination).code,
    [options?.country, options?.destination]
  );

  const placeOptions = useMemo(() => {
    const out: Array<{ id: string; title: string; dayIndex?: number }> = [];
    for (const day of options?.dailySchedule ?? []) {
      for (const item of day.items) {
        if (item.placeId) {
          out.push({
            id: item.placeId,
            title: item.title,
            dayIndex: day.day,
          });
        }
      }
    }
    return out;
  }, [options?.dailySchedule]);

  const addMember = useCallback(
    async (displayName: string) => {
      const supabase = getBrowserSupabase();
      if (!supabase) return false;
      const row = await addTripMember(supabase, tripId, displayName);
      if (!row) return false;
      setMembers((prev) => [...prev, row]);
      return true;
    },
    [tripId]
  );

  const removeMember = useCallback(async (memberId: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return false;
    const ok = await removeTripMember(supabase, memberId);
    if (ok) await reload();
    return ok;
  }, [reload]);

  const saveExpense = useCallback(
    async (input: ExpenseUpsertInput, expenseId?: string) => {
      const supabase = getBrowserSupabase();
      if (!supabase || memberIds.length === 0) return null;

      const withActor: ExpenseUpsertInput = {
        ...input,
        createdBy: input.createdBy ?? user?.id,
      };

      const row = expenseId
        ? await updateExpense(supabase, expenseId, withActor, memberIds)
        : await insertExpense(supabase, tripId, withActor, memberIds);

      if (row) {
        setExpenses((prev) => {
          if (expenseId) {
            return prev.map((e) => (e.id === expenseId ? row : e));
          }
          return [...prev, row];
        });
      }
      return row;
    },
    [memberIds, tripId, user?.id]
  );

  const removeExpense = useCallback(async (expenseId: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return false;
    const ok = await deleteLedgerExpense(supabase, expenseId);
    if (ok) setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    return ok;
  }, []);

  const buildUpsertFromAmount = useCallback(
    async (params: {
      paidBy: string;
      label: string;
      category: string;
      amount: number;
      currency: string;
      placeId?: string | null;
      spentOn?: string | null;
      dayIndex?: number | null;
      splitType?: "equal" | "custom";
      shares?: Record<string, number>;
      participantIds?: string[] | null;
    }): Promise<ExpenseUpsertInput | null> => {
      const fx = await getFxRateToKrw(params.currency);
      if (!fx || !(fx.krw > 0)) return null;
      const krwAmount = toKrw(params.amount, fx.krw);
      if (krwAmount <= 0) return null;

      const participantIds =
        params.participantIds && params.participantIds.length > 0
          ? params.participantIds
          : memberIds;
      const shares =
        params.splitType === "custom" && params.shares
          ? params.shares
          : splitEqual(krwAmount, participantIds);

      return {
        paidBy: params.paidBy,
        label: params.label,
        category: params.category,
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        fxRateToKrw: fx.krw,
        krwAmount,
        placeId: params.placeId ?? null,
        spentOn: params.spentOn ?? null,
        dayIndex: params.dayIndex ?? null,
        splitType: params.splitType ?? "equal",
        shares,
      };
    },
    [memberIds]
  );

  return {
    loading,
    error,
    members,
    expenses,
    totalKrw,
    spendByPlaceId,
    settlement,
    defaultCurrency,
    placeOptions,
    reload,
    addMember,
    removeMember,
    saveExpense,
    removeExpense,
    buildUpsertFromAmount,
    enabled: Boolean(user && provider !== "guest"),
  };
}
