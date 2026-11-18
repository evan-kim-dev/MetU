"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requiresCommunityLogin } from "@/lib/auth/community-access";
import {
  fetchUnreadNotificationCount,
  subscribeNotifications,
} from "@/lib/community/notifications-supabase";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function HomeNotificationBell() {
  const { user, provider, isReady } = useAuth();
  const [unread, setUnread] = useState(0);
  const needsLogin = requiresCommunityLogin(user, provider);

  const refresh = useCallback(async () => {
    if (!user?.id || needsLogin) {
      setUnread(0);
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setUnread(0);
      return;
    }
    const count = await fetchUnreadNotificationCount(supabase, user.id);
    setUnread(count);
  }, [needsLogin, user?.id]);

  useEffect(() => {
    if (!isReady) return;
    void refresh();
  }, [isReady, refresh]);

  useEffect(() => {
    if (!isReady || !user?.id || needsLogin) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = subscribeNotifications(supabase, user.id, () => {
      void refresh();
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isReady, needsLogin, refresh, user?.id]);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `알림 ${unread}개` : "알림"}
      className="mu-focus relative z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full text-mu-fg transition-colors active:bg-mu-sunken"
    >
      <Bell className="h-5 w-5" strokeWidth={2.2} />
      {unread > 0 ? (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-mu-accent px-1 text-mu-caption font-bold leading-none text-mu-on-accent">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}