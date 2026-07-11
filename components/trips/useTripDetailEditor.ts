"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { STYLE_LABELS } from "@/lib/trips/data";
import {
  buildSharedTripUrl,
  ensureTripShareToken,
} from "@/lib/trips/share";
import { useTrips } from "@/lib/trips/TripProvider";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Trip, TripDaySchedule, TripExpense } from "@/lib/trips/types";

export type TripEditSection = "budget" | "expense" | "memo" | null;

function parseAmount(raw: string): number {
  return Number(raw.replace(/[^0-9]/g, "")) || 0;
}

function recalcDayTotal(day: TripDaySchedule): TripDaySchedule {
  return {
    ...day,
    dayTotal: day.items.reduce((sum, item) => sum + (item.cost || 0), 0),
  };
}

export function useTripDetailEditor(tripId: string) {
  const router = useRouter();
  const { user, provider } = useAuth();
  const { getTrip, ensureTripDetail, updateTrip, removeTrip, isReady } = useTrips();
  const trip = getTrip(tripId);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!isReady || !tripId) return;
    let cancelled = false;
    setDetailLoading(true);
    void ensureTripDetail(tripId).finally(() => {
      if (!cancelled) setDetailLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ensureTripDetail, isReady, tripId]);

  const [editSection, setEditSection] = useState<TripEditSection>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState("");
  const [draftBudget, setDraftBudget] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    label: "",
    category: "",
    amount: "",
    date: "",
  });
  const [draftMemo, setDraftMemo] = useState("");
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null);
  const [draftDay, setDraftDay] = useState<TripDaySchedule | null>(null);

  const remaining = trip ? trip.budget - trip.spent : 0;
  const usedPercent = trip
    ? Math.round((trip.spent / Math.max(trip.budget, 1)) * 100)
    : 0;

  const styleLabels = useMemo(
    () => trip?.styles.map((style) => STYLE_LABELS[style] ?? style) ?? [],
    [trip?.styles]
  );

  const clearSideEdits = () => {
    setEditingExpenseId(null);
    setEditingDayIndex(null);
    setDraftDay(null);
  };

  const openBudgetEdit = () => {
    if (!trip) return;
    setDraftBudget(String(trip.budget));
    setEditSection("budget");
    clearSideEdits();
  };

  const saveBudget = () => {
    if (!trip) return;
    const budget = parseAmount(draftBudget);
    if (budget < 1) return;
    updateTrip(trip.id, { budget });
    setEditSection(null);
  };

  const openExpenseEdit = (expense: TripExpense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      label: expense.label,
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date,
    });
    setEditSection("expense");
    setEditingDayIndex(null);
    setDraftDay(null);
  };

  const openExpenseAdd = () => {
    setEditingExpenseId("new");
    setExpenseForm({
      label: "",
      category: "기타",
      amount: "",
      date: "직접 입력",
    });
    setEditSection("expense");
    setEditingDayIndex(null);
    setDraftDay(null);
  };

  const saveExpense = () => {
    if (!trip) return;
    const amount = parseAmount(expenseForm.amount);
    if (!expenseForm.label.trim() || amount < 1) return;

    let nextExpenses: TripExpense[];
    if (editingExpenseId === "new") {
      nextExpenses = [
        ...trip.expenses,
        {
          id: `exp-${Date.now()}`,
          label: expenseForm.label.trim(),
          category: expenseForm.category.trim() || "기타",
          amount,
          date: expenseForm.date.trim() || "직접 입력",
        },
      ];
    } else {
      nextExpenses = trip.expenses.map((item) =>
        item.id === editingExpenseId
          ? {
              ...item,
              label: expenseForm.label.trim(),
              category: expenseForm.category.trim() || "기타",
              amount,
              date: expenseForm.date.trim() || item.date,
            }
          : item
      );
    }

    updateTrip(trip.id, { expenses: nextExpenses });
    setEditSection(null);
    setEditingExpenseId(null);
  };

  const deleteExpense = (id: string) => {
    if (!trip) return;
    const ok = window.confirm("이 지출 항목을 삭제할까요?");
    if (!ok) return;
    updateTrip(trip.id, {
      expenses: trip.expenses.filter((item) => item.id !== id),
    });
    if (editingExpenseId === id) {
      setEditSection(null);
      setEditingExpenseId(null);
    }
  };

  const openMemoEdit = () => {
    if (!trip) return;
    setDraftMemo(trip.memo ?? "");
    setEditSection("memo");
    clearSideEdits();
  };

  const saveMemo = () => {
    if (!trip) return;
    updateTrip(trip.id, { memo: draftMemo.trim() });
    setEditSection(null);
  };

  const openDayEdit = (dayIndex: number) => {
    if (!trip?.dailySchedule?.[dayIndex]) return;
    const day = trip.dailySchedule[dayIndex];
    setDraftDay({
      ...day,
      items: day.items.map((item) => ({ ...item })),
    });
    setEditingDayIndex(dayIndex);
    setEditSection(null);
    setEditingExpenseId(null);
  };

  const cancelDayEdit = () => {
    setEditingDayIndex(null);
    setDraftDay(null);
  };

  const updateDraftItem = (
    itemIndex: number,
    patch: Partial<{ time: string; title: string; cost: string }>
  ) => {
    setDraftDay((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((item, iIdx) => {
        if (iIdx !== itemIndex) return item;
        return {
          ...item,
          time: patch.time ?? item.time,
          title: patch.title ?? item.title,
          cost: patch.cost !== undefined ? parseAmount(patch.cost) : item.cost,
        };
      });
      return recalcDayTotal({ ...prev, items });
    });
  };

  const addDraftItem = () => {
    setDraftDay((prev) => {
      if (!prev) return prev;
      return recalcDayTotal({
        ...prev,
        items: [...prev.items, { time: "12:00", title: "", cost: 0 }],
      });
    });
  };

  const removeDraftItem = (itemIndex: number) => {
    setDraftDay((prev) => {
      if (!prev) return prev;
      return recalcDayTotal({
        ...prev,
        items: prev.items.filter((_, i) => i !== itemIndex),
      });
    });
  };

  const saveDayEdit = (dayIndex: number) => {
    if (!trip || !draftDay) return;
    const cleaned = recalcDayTotal({
      ...draftDay,
      label: `Day ${draftDay.day}`,
      items: draftDay.items
        .map((item) => ({
          ...item,
          time: item.time.trim() || "00:00",
          title: item.title.trim(),
          cost: item.cost || 0,
        }))
        .filter((item) => item.title.length > 0),
    });
    const nextSchedule = (trip.dailySchedule ?? []).map((day, idx) =>
      idx === dayIndex ? cleaned : day
    );
    updateTrip(trip.id, { dailySchedule: nextSchedule });
    cancelDayEdit();
  };

  const handleDelete = () => {
    if (!trip || isDeleting) return;
    const ok = window.confirm(
      `"${trip.destination}" 여행을 삭제할까요?\n홈의 진행 중 여행·팁·환율도 함께 갱신돼요.`
    );
    if (!ok) return;
    setIsDeleting(true);
    removeTrip(trip.id);
    router.replace("/");
  };

  async function handleShareTrip() {
    if (!trip) return;

    setShareError("");

    const supabase = getBrowserSupabase();
    if (!supabase || !user?.id || provider === "guest") {
      setShareError("공유하려면 로그인한 뒤 Supabase에 저장된 여행이어야 해요.");
      return;
    }

    const token = await ensureTripShareToken(supabase, user.id, trip.id);
    if (!token) {
      setShareError("공유 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    const url = buildSharedTripUrl(token);
    const title = `${trip.destination} 여행`;
    const text = `${trip.destination} 여행 일정을 함께 봐요.`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt("아래 링크를 복사하세요", url);
    }
  }

  return {
    trip: trip as Trip | undefined,
    isReady,
    detailLoading,
    remaining,
    usedPercent,
    styleLabels,
    editSection,
    setEditSection,
    isDeleting,
    shareCopied,
    shareError,
    draftBudget,
    setDraftBudget,
    editingExpenseId,
    setEditingExpenseId,
    expenseForm,
    setExpenseForm,
    draftMemo,
    setDraftMemo,
    editingDayIndex,
    draftDay,
    openBudgetEdit,
    saveBudget,
    openExpenseEdit,
    openExpenseAdd,
    saveExpense,
    deleteExpense,
    openMemoEdit,
    saveMemo,
    openDayEdit,
    cancelDayEdit,
    updateDraftItem,
    addDraftItem,
    removeDraftItem,
    saveDayEdit,
    handleDelete,
    handleShareTrip,
  };
}
