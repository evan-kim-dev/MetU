"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

const PUBLIC_PATHS = ["/login", "/legal", "/auth"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * 미로그인 사용자를 /login 으로 보내고,
 * 이미 로그인한 사용자가 /login 에 있으면 홈으로 돌린다.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isReady, isLoggedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const publicPath = isPublicPath(pathname);

  useEffect(() => {
    if (!isReady) return;

    if (!isLoggedIn && !publicPath) {
      const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
      router.replace(`/login${next}`);
      return;
    }

    if (isLoggedIn && pathname === "/login") {
      // Soft nav can keep a stale client bundle after OAuth; force a full load.
      window.location.replace("/");
    }
  }, [isReady, isLoggedIn, pathname, publicPath, router]);

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
