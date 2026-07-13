"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requiresCommunityLogin } from "@/lib/auth/community-access";
import { useFriends } from "@/lib/friends/FriendsProvider";
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
    case "friend_request":
      return {
        title: "친구 요청",
        body: `${actorName}님이 친구를 요청했어요.`,
      };
    case "friend_accepted":
      return {
        title: "친구 수락",
        body: `${actorName}님이 친구 요청을 수락했어요.`,
      };
    case "friend_rejected":
      return {
        title: "친구 거절",
        body: `${actorName}님이 친구 요청을 거절했어요.`,
      };
    case "dm_message":
      return {
        title: "새 메시지",
        body: `${actorName}: ${n.payload.preview ?? "메시지를 보냈어요."}`,
      };
    default:
      return { title: "알림", body: postTitle };
  }
}

export function NotificationsPageContent() {
  const router = useRouter();
  const { user, provider, isReady } = useAuth();
  const { acceptFriend, rejectFriend, refreshFriends } = useFriends();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
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

  async function markRead(n: AppNotification) {
    if (!user?.id || n.readAt) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    await markNotificationReadInSupabase(supabase, n.id, user.id);
    setItems((prev) =>
      prev.map((item) =>
        item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item
      )
    );
  }

  async function handleOpen(n: AppNotification) {
    await markRead(n);
    if (n.type === "dm_message" && n.actorId) {
      router.push(`/opod/dm/${n.actorId}`);
      return;
    }
    if (n.type.startsWith("friend_")) {
      router.push("/opod");
      return;
    }
    if (n.postId) {
      router.push(`/board/${n.postId}`);
    }
  }

  async function handleFriendAction(
    n: AppNotification,
    action: "accept" | "reject"
  ) {
    if (!n.actorId || actionId) return;
    setActionId(n.id);
    try {
      const ok =
        action === "accept"
          ? await acceptFriend(n.actorId)
          : await rejectFriend(n.actorId);
      if (!ok) return;
      await markRead(n);
      await refreshFriends();
      setItems((prev) => prev.filter((item) => item.id !== n.id));
    } finally {
      setActionId(null);
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
          <div className="h-16 animate-pulse rounded-2xl bg-surface-soft" />
          <div className="h-16 animate-pulse rounded-2xl bg-surface-soft" />
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
            const isFriendRequest = n.type === "friend_request";

            return (
              <div
                key={n.id}
                className={`flex w-full flex-col gap-2 rounded-2xl border px-4 py-3.5 text-left ${
                  unread
                    ? "border-brand/25 bg-brand/5"
                    : "border-line-soft bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleOpen(n)}
                  className="flex w-full flex-col gap-1 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-brand">
                      {copy.title}
                    </span>
                    <span className="text-xs text-ink-caption">
                      {n.createdAtLabel}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-snug text-ink-heading">
                    {copy.body}
                  </p>
                </button>

                {isFriendRequest && n.actorId ? (
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      disabled={actionId === n.id}
                      onClick={() => void handleFriendAction(n, "reject")}
                      className="h-9 flex-1 rounded-full border border-line-soft bg-surface-white text-xs font-bold text-ink-body disabled:opacity-50"
                    >
                      거절
                    </button>
                    <button
                      type="button"
                      disabled={actionId === n.id}
                      onClick={() => void handleFriendAction(n, "accept")}
                      className="h-9 flex-1 rounded-full bg-brand text-xs font-bold text-surface-white disabled:opacity-50"
                    >
                      수락
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </MobileShell>
  );
}
