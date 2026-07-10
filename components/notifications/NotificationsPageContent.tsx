"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requiresCommunityLogin } from "@/lib/auth/community-access";
import type { AppNotification } from "@/lib/community/notifications-supabase";
import {
  fetchNotificationsFromSupabase,
  markAllNotificationsReadInSupabase,
  markNotificationReadInSupabase,
  subscribeNotifications,
} from "@/lib/community/notifications-supabase";
import { getBrowserSupabase } from "@/lib/supabase/browser";

function notificationCopy(n: AppNotification): { title: string; body: string } {
  const postTitle = n.payload.postTitle ?? "동행 모집";
  const actorName = n.payload.actorName ?? "누군가";

  switch (n.type) {
    case "party_join_request":
      return {
        title: "참여 요청",
        body: `${actorName}님이 「${postTitle}」에 참여를 요청했어요.`,
      };
    case "party_join_accepted":
      return {
        title: "참여 수락",
        body: `「${postTitle}」 참여가 수락됐어요. 채팅방에 입장할 수 있어요.`,
      };
    case "party_join_rejected":
      return {
        title: "참여 거절",
        body: `「${postTitle}」 참여 요청이 거절됐어요.`,
      };
    default:
      return { title: "알림", body: postTitle };
  }
}

export function NotificationsPageContent() {
  const router = useRouter();
  const { user, provider, isReady } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const needsLogin = requiresCommunityLogin(user, provider);

  const load = useCallback(async () => {
    if (!user?.id || needsLogin) {
      setItems([]);
      setLoading(false);
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setItems([]);
      setLoading(false);
      return;
    }
    const list = await fetchNotificationsFromSupabase(supabase, user.id);
    setItems(list);
    setLoading(false);
  }, [needsLogin, user?.id]);

  useEffect(() => {
    if (!isReady) return;
    setLoading(true);
    void load();
  }, [isReady, load]);

  useEffect(() => {
    if (!isReady || !user?.id || needsLogin) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = subscribeNotifications(supabase, user.id, () => {
      void load();
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isReady, load, needsLogin, user?.id]);

  async function handleOpen(n: AppNotification) {
    if (!user?.id) return;
    const supabase = getBrowserSupabase();
    if (supabase && !n.readAt) {
      await markNotificationReadInSupabase(supabase, n.id, user.id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item
        )
      );
    }
    if (n.postId) {
      router.push(`/board/${n.postId}`);
    }
  }

  async function handleMarkAllRead() {
    if (!user?.id) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    await markAllNotificationsReadInSupabase(supabase, user.id);
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })));
  }

  if (!isReady || loading) {
    return (
      <MobileShell title="알림" showBack backHref="/">
        <div className="flex flex-col gap-3 px-5 py-6">
          <div className="h-16 animate-pulse rounded-xl2 bg-surface-soft" />
          <div className="h-16 animate-pulse rounded-xl2 bg-surface-soft" />
        </div>
      </MobileShell>
    );
  }

  if (needsLogin) {
    return (
      <MobileShell title="알림" showBack backHref="/">
        <div className="flex flex-col items-center gap-4 px-5 py-20 text-center">
          <p className="text-base font-bold text-ink-heading">
            알림은 로그인 후 확인할 수 있어요.
          </p>
          <PrimaryButton
            fullWidth={false}
            className="px-6"
            onClick={() => router.push("/login?next=/notifications")}
          >
            로그인하러 가기
          </PrimaryButton>
        </div>
      </MobileShell>
    );
  }

  const hasUnread = items.some((n) => !n.readAt);

  return (
    <MobileShell
      title="알림"
      showBack
      backHref="/"
      rightSlot={
        hasUnread ? (
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            className="px-1 text-xs font-bold text-brand"
          >
            모두 읽음
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2 px-5 pb-10 pt-4">
        {items.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-ink-caption">
            아직 알림이 없어요
          </p>
        ) : (
          items.map((n) => {
            const copy = notificationCopy(n);
            const unread = !n.readAt;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => void handleOpen(n)}
                className={`flex w-full flex-col gap-1 rounded-xl2 border px-4 py-3.5 text-left transition-colors active:bg-surface-soft ${
                  unread
                    ? "border-brand/25 bg-brand/5"
                    : "border-line-soft bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-brand">{copy.title}</span>
                  <span className="text-[11px] text-ink-caption">{n.createdAtLabel}</span>
                </div>
                <p className="text-sm font-semibold leading-snug text-ink-heading">
                  {copy.body}
                </p>
              </button>
            );
          })
        )}
      </div>
    </MobileShell>
  );
}
