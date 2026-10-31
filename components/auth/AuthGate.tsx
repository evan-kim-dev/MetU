"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isPublicPagePath } from "@/lib/auth/route-access";
import { safeNextPath } from "@/lib/security/safe-next";

/**
 * 미로그인 사용자를 /login 으로 보내고,
 * 이미 로그인한 사용자가 /login 에 있으면 next 또는 홈으로 돌린다.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isReady, isLoggedIn } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const publicPath = isPublicPagePath(pathname);

  useEffect(() => {
    if (!isReady) return;

    if (!isLoggedIn && !publicPath) {
      const qs = searchParams.toString();
      const returnPath = qs ? `${pathname}?${qs}` : pathname;
      const next = returnPath === "/" ? "" : `?next=${encodeURIComponent(returnPath)}`;
      router.replace(`/login${next}`);
      return;
    }

    if (isLoggedIn && pathname === "/login") {
      const target = safeNextPath(searchParams.get("next"), "/");
      // Soft nav can keep a stale client bundle after OAuth; force a full load.
      window.location.replace(target);
    }
  }, [isReady, isLoggedIn, pathname, searchParams, publicPath, router]);

  // Public routes: render immediately (no auth spinner waterfall).
  if (publicPath) {
    return <>{children}</>;
  }

  if (!isReady) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-surface-base">
        <div className="h-8 w-8 animate-pulse rounded-full bg-brand/20" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-surface-base">
        <div className="h-8 w-8 animate-pulse rounded-full bg-brand/20" />
      </div>
    );
  }

  return <>{children}</>;
}
