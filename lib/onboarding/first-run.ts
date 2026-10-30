"use client";

import { useMemo, useSyncExternalStore } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";
import type { AutomationUiState } from "@/lib/onboarding/automation-ui-state";
import { useTrips } from "@/lib/trips/TripProvider";

export type FirstRunStepId = "connect" | "trip" | "expense";

export type FirstRunStep = {
  id: FirstRunStepId;
  done: boolean;
};

export const FIRST_RUN_DONE_KEY = "metu.firstrun.done.v1";
export const FIRST_RUN_DISMISSED_KEY = "metu.firstrun.dismissed.v1";

let sessionDismissed = false;
let sessionDone = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function readFlag(key: string, sessionFallback: boolean): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return sessionFallback;
  }
}

function getDismissedSnapshot() {
  return readFlag(FIRST_RUN_DISMISSED_KEY, sessionDismissed);
}

function getDoneSnapshot() {
  return readFlag(FIRST_RUN_DONE_KEY, sessionDone);
}

export function markFirstRunDismissed() {
  try {
    window.localStorage.setItem(FIRST_RUN_DISMISSED_KEY, "1");
  } catch {
    sessionDismissed = true;
  }
  emit();
}

export function markFirstRunDone() {
  try {
    window.localStorage.setItem(FIRST_RUN_DONE_KEY, "1");
  } catch {
    sessionDone = true;
  }
  emit();
}

export function computeFirstRun(input: {
  uiState: AutomationUiState;
  hasActiveTrip: boolean;
  hasAnyExpense: boolean;
}): { steps: FirstRunStep[]; doneCount: number; allDone: boolean } {
  const steps: FirstRunStep[] = [
    {
      id: "connect",
      done: input.uiState === "ok" || input.uiState === "silent",
    },
    { id: "trip", done: input.hasActiveTrip },
    { id: "expense", done: input.hasAnyExpense },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, allDone: doneCount === 3 };
}

export function tripsHaveAnyExpense(
  trips: { expenses: unknown[]; spent: number }[]
): boolean {
  return trips.some((t) => t.expenses.length > 0 || t.spent > 0);
}

/** True while FirstRunChecklist card (not allDone, not dismissed) would show. */
export function useFirstRunVisible(): boolean {
  const { isReady, isLoggedIn, provider } = useAuth();
  const isGuest = provider === "guest";
  const { trips, isReady: tripsReady, activeTrips } = useTrips();
  const enabled = isReady && isLoggedIn && !isGuest;
  const { uiState, loading, error } = useAutomationStatus({
    enabled,
    lite: true,
  });
  const dismissed = useSyncExternalStore(
    subscribe,
    getDismissedSnapshot,
    () => false
  );
  const doneStored = useSyncExternalStore(
    subscribe,
    getDoneSnapshot,
    () => false
  );

  return useMemo(() => {
    if (!enabled || dismissed || doneStored) return false;
    if (!tripsReady || loading) return false;
    const effectiveUi: AutomationUiState = error || !uiState ? "off" : uiState;
    const { allDone } = computeFirstRun({
      uiState: effectiveUi,
      hasActiveTrip: activeTrips.length > 0,
      hasAnyExpense: tripsHaveAnyExpense(trips),
    });
    return !allDone;
  }, [
    enabled,
    dismissed,
    doneStored,
    tripsReady,
    loading,
    error,
    uiState,
    activeTrips.length,
    trips,
  ]);
}
