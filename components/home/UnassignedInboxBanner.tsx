"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { INBOX_NAME } from "@/lib/ledger/inbox-copy";
import { fetchUnassignedInboxCount } from "@/lib/ledger/inbox-count";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/** Lightweight unassigned count — uses shared inbox-count helper. */
export function UnassignedInboxBanner() {
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

  if (!isReady || !user || provider === "guest" || count <= 0) {
    return null;
  }

  return (
    <Link
      href="/agent/inbox"
      className="flex min-h-11 items-center justify-between gap-3 rounded-xl2 bg-amber-50 px-4 py-3 ring-1 ring-amber-200 transition-opacity active:opacity-90"
    >
      <span className="text-sm font-bold text-amber-950">
        여행 없이 모인 알림 {count}건 · {INBOX_NAME} 보기
      </span>
      <span className="text-xs font-bold text-amber-800" aria-hidden>
        →
      </span>
    </Link>
  );
}
