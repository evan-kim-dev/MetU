"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchUnassignedInboxCount } from "@/lib/ledger/inbox-count";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/** 상단/하단 확인함 배지용 미배정 건수. */
export function useUnassignedInboxCount(): number {
  const { user, provider, isReady } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user || provider === "guest") {
      setCount(0);
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setCount(0);
      return;
    }
    try {
      setCount(await fetchUnassignedInboxCount(supabase, user.id));
    } catch {
      setCount(0);
    }
  }, [user, provider]);

  useEffect(() => {
    if (!isReady) return;
    void refresh();
  }, [isReady, refresh]);

  return count;
}
