"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { INBOX_NAME } from "@/lib/ledger/inbox-copy";
import { fetchUnassignedInboxCount } from "@/lib/ledger/inbox-count";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * 상단 바 우측 확인함 입구. 미배정 건수가 있으면 배지를 보여 줘요.
 */
export function InboxTopButton() {
  const pathname = usePathname();
  const { user, provider, isReady } = useAuth();
  const [count, setCount] = useState(0);
  const active =
    pathname === "/agent/inbox" ||
    pathname.startsWith("/agent/inbox/") ||
    /\/trips\/[^/]+\/ledger\/inbox\/?$/.test(pathname);

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

  const label =
    count > 0 ? `${INBOX_NAME} ${count > 9 ? "9+" : count}건` : INBOX_NAME;

  return (
    <Link
      href="/agent/inbox"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="mu-focus relative flex h-11 w-11 items-center justify-center rounded-mu-md text-mu-fg transition-colors active:bg-mu-sunken"
    >
      <Inbox
        className={[
          "h-5 w-5",
          active ? "text-mu-accent" : "text-mu-fg-2",
        ].join(" ")}
        strokeWidth={active ? 2.25 : 1.75}
        aria-hidden
      />
      {count > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-mu-err px-1 text-mu-caption font-extrabold leading-none text-mu-on-accent">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
