"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound } from "lucide-react";

/**
 * 상단 바 우측 내 정보 입구.
 */
export function ProfileTopButton() {
  const pathname = usePathname();
  const active =
    pathname === "/profile" || pathname.startsWith("/profile/");

  return (
    <Link
      href="/profile"
      aria-label="내 정보"
      aria-current={active ? "page" : undefined}
      className="mu-focus relative flex h-11 w-11 items-center justify-center rounded-mu-md text-mu-fg transition-colors active:bg-mu-sunken"
    >
      <CircleUserRound
        className={[
          "h-5 w-5",
          active ? "text-mu-accent" : "text-mu-fg-2",
        ].join(" ")}
        strokeWidth={active ? 2.25 : 1.75}
        aria-hidden
      />
    </Link>
  );
}
