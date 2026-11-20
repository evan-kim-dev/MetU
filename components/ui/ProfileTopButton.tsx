"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound } from "lucide-react";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { isAvatarImage } from "@/lib/profile/public";

function normalizeAvatarSrc(src: string): string {
  return src.replace(/^http:\/\//i, "https://");
}

/**
 * 상단 바 우측 내 정보 입구.
 * 로그인 프로필 사진이 있으면 원형 아바타로 보여 줘요.
 */
export function ProfileTopButton() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const [imageFailed, setImageFailed] = useState(false);
  const active =
    pathname === "/profile" || pathname.startsWith("/profile/");

  const rawAvatar =
    (profile.customAvatarUrl?.trim() || profile.avatarUrl.trim() || "");
  const avatarSrc =
    rawAvatar && isAvatarImage(rawAvatar)
      ? normalizeAvatarSrc(rawAvatar)
      : null;

  useEffect(() => {
    setImageFailed(false);
  }, [avatarSrc]);

  const showPhoto = Boolean(avatarSrc) && !imageFailed;

  return (
    <Link
      href="/profile"
      aria-label="내 정보"
      aria-current={active ? "page" : undefined}
      className="mu-focus relative flex h-11 w-11 items-center justify-center rounded-mu-md text-mu-fg transition-colors active:bg-mu-sunken"
    >
      {showPhoto && avatarSrc ? (
        <span
          className={[
            "relative h-8 w-8 overflow-hidden rounded-full bg-mu-sunken",
            active ? "ring-2 ring-mu-accent ring-offset-1 ring-offset-mu-card" : "",
          ].join(" ")}
        >
          {/* 카카오 CDN 등은 next/image 호스트 제한에 자주 걸려 img 사용 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        </span>
      ) : (
        <CircleUserRound
          className={[
            "h-5 w-5",
            active ? "text-mu-accent" : "text-mu-fg-2",
          ].join(" ")}
          strokeWidth={active ? 2.25 : 1.75}
          aria-hidden
        />
      )}
    </Link>
  );
}
