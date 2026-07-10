"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ensureWithactChecklistSession,
  resolveWithactGuestId,
  saveWithactChecklistItem,
  type SaveWithactChecklistItemInput,
  type WithactChecklistSession,
} from "@/lib/checklist/withact";

export function useWithactChecklist(totalBudget = 0) {
  const { user } = useAuth();
  const sessionRef = useRef<WithactChecklistSession | null>(null);
  const guestId = resolveWithactGuestId(user);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const session = await ensureWithactChecklistSession(guestId, totalBudget);
      if (!cancelled) {
        sessionRef.current = session;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [guestId, totalBudget]);

  const persistItem = useCallback(
    async (input: SaveWithactChecklistItemInput) => {
      let session = sessionRef.current;
      if (!session) {
        session = await ensureWithactChecklistSession(guestId, totalBudget);
        sessionRef.current = session;
      }
      if (!session) return false;
      return saveWithactChecklistItem(session, input);
    },
    [guestId, totalBudget]
  );

  return { persistItem };
}
