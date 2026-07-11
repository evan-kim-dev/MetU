"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { isAvatarImage } from "@/lib/profile/public";
import { AuthorProfilePopup } from "@/components/community/AuthorProfilePopup";

interface AuthorAvatarLinkProps {
  userId: string;
  name: string;
  avatar: string;
  size?: "sm" | "md";
  className?: string;
  /** true면 이름도 같이 눌러 프로필 팝업을 연다 */
  showName?: boolean;
  meta?: string;
  /** 이름 옆 액션 (예: 친구 추가) */
  nameTrailing?: ReactNode;
}

const SIZE_CLASS = {
  sm: "h-8 w-8 text-base",
  md: "h-10 w-10 text-lg",
} as const;

export function AuthorAvatarLink({
  userId,
  name,
  avatar,
  size = "sm",
  className = "",
  showName = false,
  meta,
  nameTrailing,
}: AuthorAvatarLinkProps) {
  const [open, setOpen] = useState(false);
  const src = avatar.trim();
  const showImage = isAvatarImage(src);

  const openProfile = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  const avatarVisual = (
    <span
      className={[
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-soft bg-surface-soft",
        SIZE_CLASS[size],
      ].join(" ")}
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="leading-none">{src || "👤"}</span>
      )}
    </span>
  );

  return (
    <>
      {showName ? (
        <div className={["flex min-w-0 items-center gap-2", className].join(" ")}>
          <button
            type="button"
            aria-label={`${name} 프로필 보기`}
            onClick={openProfile}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex min-w-0 items-center gap-2 text-left transition-opacity active:opacity-80"
          >
            {avatarVisual}
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink-heading">
                {name}
              </span>
              {meta ? (
                <span className="block text-xs text-ink-caption">{meta}</span>
              ) : null}
            </span>
          </button>
          {nameTrailing}
        </div>
      ) : (
        <button
          type="button"
          aria-label={`${name} 프로필 보기`}
          onClick={openProfile}
          onMouseDown={(event) => event.stopPropagation()}
          className={[
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-soft bg-surface-soft transition-opacity active:opacity-80",
            SIZE_CLASS[size],
            className,
          ].join(" ")}
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="leading-none" aria-hidden>
              {src || "👤"}
            </span>
          )}
        </button>
      )}

      <AuthorProfilePopup
        open={open}
        onClose={() => setOpen(false)}
        userId={userId}
        fallbackName={name}
        fallbackAvatar={avatar}
      />
    </>
  );
}
