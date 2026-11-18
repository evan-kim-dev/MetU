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
      className="flex min-h-11 items-center justify-between gap-3 rounded-mu-xl border border-mu-warn/30 bg-mu-warn-soft px-4 py-3 transition-opacity active:opacity-90"
    >
      <span className="text-sm font-bold text-mu-warn">
        여행 없이 모인 알림 {count}건 · {INBOX_NAME} 보기
      </span>
      <span className="text-xs font-bold text-mu-warn" aria-hidden>
        →
      </span>
    </Link>
  );
}