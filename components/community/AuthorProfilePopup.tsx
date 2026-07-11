"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { isAvatarImage, type PublicProfile } from "@/lib/profile/public";
import { FriendAddButton } from "@/components/community/FriendAddButton";

interface AuthorProfilePopupProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  fallbackName: string;
  fallbackAvatar: string;
}

function ProfileAvatar({ src, name }: { src: string; name: string }) {
  const value = src.trim();
  return (
    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-surface-base bg-surface-soft shadow-sm">
      {isAvatarImage(value) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt={`${name} 프로필`}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-4xl leading-none" aria-hidden>
          {value || "👤"}
        </span>
      )}
    </div>
  );
}

export function AuthorProfilePopup({
  open,
  onClose,
  userId,
  fallbackName,
  fallbackAvatar,
}: AuthorProfilePopupProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setProfile(null);

    void fetch(`/api/users/${encodeURIComponent(userId)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("not-found");
        return (await res.json()) as { profile?: PublicProfile };
      })
      .then((data) => {
        if (!cancelled && data.profile) setProfile(data.profile);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const name = profile?.name?.trim() || fallbackName;
  const avatar =
    profile?.avatarUrl?.trim() ||
    (isAvatarImage(fallbackAvatar) ? fallbackAvatar : fallbackAvatar) ||
    "👤";
  const bio = profile?.bio?.trim() || "";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-heading/40 px-6 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[300px] rounded-[28px] bg-surface-white px-6 pb-7 pt-6 text-center shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-caption transition-colors active:bg-surface-soft"
        >
          <X className="h-4 w-4" strokeWidth={2.4} />
        </button>

        <div className="flex flex-col items-center">
          {loading ? (
            <div className="h-24 w-24 animate-pulse rounded-full bg-surface-soft" />
          ) : (
            <ProfileAvatar src={avatar} name={name} />
          )}

          <h2
            id={titleId}
            className="mt-4 text-lg font-extrabold tracking-tight text-ink-heading"
          >
            {loading ? "불러오는 중…" : name}
          </h2>

          {profile?.membershipLabel ? (
            <p className="mt-1 text-[11px] font-bold text-brand">
              {profile.membershipLabel}
            </p>
          ) : null}

          <div className="mt-4 w-full rounded-2xl bg-surface-soft/80 px-4 py-3 text-left">
            <p className="mb-1 text-[11px] font-bold tracking-wide text-ink-caption">
              소개
            </p>
            {loading ? (
              <div className="space-y-2" aria-hidden>
                <div className="h-2.5 w-full animate-pulse rounded-full bg-line-soft" />
                <div className="h-2.5 w-[80%] animate-pulse rounded-full bg-line-soft" />
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-body">
                {bio || "아직 소개를 적지 않았어요."}
              </p>
            )}
          </div>

          <FriendAddButton
            friendId={userId}
            friendName={name}
            variant="popup"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
