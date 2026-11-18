"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requiresCommunityLogin } from "@/lib/auth/community-access";
import {
  fetchUnreadNotificationCount,
  subscribeNotifications,
} from "@/lib/community/notifications-supabase";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = {
  /** icon = 상단 아이콘(레거시). row = 내 정보 목록 행. */
  variant?: "icon" | "row";
};

/**
 * 커뮤니티 알림 입구. 홈 상단에서는 쓰지 않고, 내 정보 목록에서 쓴다.
 */
export function HomeNotificationBell({ variant = "row" }: Props) {
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

  if (variant === "icon") {
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

  return (
    <Link
      href="/notifications"
      className="flex min-h-[44px] items-center justify-between py-4 transition-colors active:bg-mu-sunken"
      aria-label={unread > 0 ? `알림 ${unread}개` : "알림"}
    >
      <span className="flex items-center gap-3">
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-membership">
          <Bell className="h-4 w-4 text-mu-fg-2" strokeWidth={2.2} />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-mu-accent px-1 text-mu-caption font-bold leading-none text-mu-on-accent">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </span>
        <span className="text-sm font-semibold tracking-wide text-mu-fg">
          알림
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-mu-fg-3" />
    </Link>
  );
}
