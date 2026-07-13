"use client";

import { useEffect, useState } from "react";
import { isAvatarImage } from "@/lib/profile/public";

type SafeAvatarProps = {
  src?: string | null;
  alt?: string;
  fallback?: string;
  className?: string;
  imgClassName?: string;
  textClassName?: string;
};

function normalizeAvatarSrc(src: string): string {
  return src.trim().replace(/^http:\/\//i, "https://");
}

/** URL이면 이미지, 실패/이모지면 이모지. URL 문자열을 텍스트로 절대 노출하지 않음. */
export function SafeAvatar({
  src,
  alt = "",
  fallback = "👤",
  className = "",
  imgClassName = "h-full w-full object-cover",
  textClassName = "leading-none",
}: SafeAvatarProps) {
  const value = normalizeAvatarSrc(src ?? "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [value]);

  const asImage = isAvatarImage(value) && !failed;

  if (asImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={value}
        alt={alt}
        className={[imgClassName, className].filter(Boolean).join(" ")}
        // 카카오 CDN은 Referer 있으면 막히는 경우가 많음
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  const emoji = !value || isAvatarImage(value) ? fallback : value;
  return (
    <span className={[textClassName, className].filter(Boolean).join(" ")} aria-hidden>
      {emoji}
    </span>
  );
}
