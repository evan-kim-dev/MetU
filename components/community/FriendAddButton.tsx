"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Clock3, UserPlus, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requiresCommunityLogin } from "@/lib/auth/community-access";
import { useFriends } from "@/lib/friends/FriendsProvider";

interface FriendAddButtonProps {
  friendId: string;
  friendName?: string;
  /** card: 작은 필, popup: 넓은 버튼 */
  variant?: "card" | "popup";
  className?: string;
}

export function FriendAddButton({
  friendId,
  friendName,
  variant = "card",
  className = "",
}: FriendAddButtonProps) {
  const router = useRouter();
  const { user, provider } = useAuth();
  const {
    isFriend,
    isPendingOutgoing,
    requestFriend,
    removeFriend,
    isReady,
  } = useFriends();
  const [busy, setBusy] = useState(false);

  const myId = user?.id ?? null;
  const isSelf = Boolean(myId && friendId && myId === friendId);
  const friended = isFriend(friendId);
  const pending = isPendingOutgoing(friendId);

  if (!friendId || isSelf) return null;

  async function handleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (requiresCommunityLogin(user, provider)) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (busy || !isReady || pending) return;
    setBusy(true);
    try {
      if (friended) {
        const ok = window.confirm(
          friendName
            ? `${friendName} 님을 친구에서 삭제할까요?`
            : "친구에서 삭제할까요?"
        );
        if (ok) await removeFriend(friendId);
      } else {
        await requestFriend(friendId);
      }
    } finally {
      setBusy(false);
    }
  }

  const label = friended ? "친구" : pending ? "요청됨" : "친구 추가";
  const cardLabel = friended ? "친구" : pending ? "요청됨" : "추가";

  if (variant === "popup") {
    return (
      <button
        type="button"
        disabled={busy || !isReady || pending}
        onClick={handleClick}
        onMouseDown={(event) => event.stopPropagation()}
        className={[
          "mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-all active:scale-[0.99] disabled:opacity-60",
          friended || pending
            ? "border border-line-soft bg-surface-soft text-ink-body"
            : "bg-brand text-surface-white",
          className,
        ].join(" ")}
      >
        {friended ? (
          <>
            <UserCheck className="h-4 w-4" strokeWidth={2.4} />
            {label}
          </>
        ) : pending ? (
          <>
            <Clock3 className="h-4 w-4" strokeWidth={2.4} />
            {label}
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" strokeWidth={2.4} />
            {label}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      disabled={busy || !isReady || pending}
      onClick={handleClick}
      onMouseDown={(event) => event.stopPropagation()}
      className={[
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 disabled:opacity-60",
        friended || pending
          ? "bg-surface-soft text-ink-body"
          : "bg-brand/10 text-brand-strong",
        className,
      ].join(" ")}
    >
      {friended ? (
        <>
          <UserCheck className="h-3 w-3" strokeWidth={2.6} />
          {cardLabel}
        </>
      ) : pending ? (
        <>
          <Clock3 className="h-3 w-3" strokeWidth={2.6} />
          {cardLabel}
        </>
      ) : (
        <>
          <UserPlus className="h-3 w-3" strokeWidth={2.6} />
          {cardLabel}
        </>
      )}
    </button>
  );
}
