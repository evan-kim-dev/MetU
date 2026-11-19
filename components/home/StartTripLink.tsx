"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

/** 미로그인·쿠키 게스트는 로그인 후 온보딩으로 유도해요. */
export function StartTripLink() {
  const { isReady, isLoggedIn, provider } = useAuth();
  const needsLogin =
    !isReady || !isLoggedIn || provider === "guest" || provider === null;
  const href = needsLogin
    ? `/login?next=${encodeURIComponent("/onboarding")}`
    : "/onboarding";

  return (
    <Link
      href={href}
      className="mu-focus flex items-center justify-between rounded-mu-xl bg-mu-accent px-5 py-4 transition-transform active:scale-[0.99]"
    >
      <div className="flex flex-col">
        <span className="text-sm font-bold text-mu-on-accent">
          새로운 여행 계획하기
        </span>
        <span className="text-xs font-medium text-mu-on-accent/80">
          {needsLogin
            ? "로그인 후 예산만 알려주면 AI가 코스를 짜드려요"
            : "예산만 알려주면 AI가 코스를 짜드려요"}
        </span>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mu-card">
        <Plus className="h-5 w-5 text-mu-accent" strokeWidth={2.6} />
      </span>
    </Link>
  );
}
