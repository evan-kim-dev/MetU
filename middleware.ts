import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE, verifyGuestCookie } from "@/lib/auth/guest-cookie";
import {
  MTU_ONB_COOKIE,
  MTU_ONB_SKIP_STATUSES,
} from "@/lib/onboarding/constants";
import { safeNextPath } from "@/lib/security/safe-next";
import { getPublicSupabaseKey } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/legal"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    ) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/trips/share/") ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/share-target")
  );
}

function isAutomationOnboardingExcluded(pathname: string) {
  return (
    pathname.startsWith("/onboarding/") ||
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/share-target") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/trips/share/")
  );
}

/**
 * Keep auth cookies fresh on every request.
 * Uses a short timeout so local/dev does not hang when auth network is slow.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API는 JSON을 반환해야 함 — 로그인 HTML로 리다이렉트하면 시세 연동이 깨짐
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  if (pathname === "/login" || pathname === "/auth/logout") {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const guestSecret =
    process.env.GUEST_COOKIE_SECRET?.trim() ||
    (process.env.NODE_ENV !== "production"
      ? "dev-guest-cookie-secret"
      : "");
  const guestVerified = await verifyGuestCookie(
    request.cookies.get(GUEST_COOKIE)?.value,
    guestSecret
  );
  const hasGuestSession = guestVerified.ok;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getPublicSupabaseKey();

  let hasUser = false;
  let userId: string | null = null;

  if (url && anonKey) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    try {
      const result = await Promise.race([
        supabase.auth.getUser(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (result && "data" in result && result.data.user?.id) {
        hasUser = true;
        userId = result.data.user.id;
      }
    } catch {
      // ignore and continue
    }
  }

  if (
    hasUser &&
    userId &&
    !hasGuestSession &&
    !isAutomationOnboardingExcluded(pathname) &&
    url &&
    anonKey
  ) {
    const onbHint = request.cookies.get(MTU_ONB_COOKIE)?.value;
    const skipDb =
      onbHint != null && MTU_ONB_SKIP_STATUSES.has(onbHint as "done" | "partial" | "skipped");

    if (!skipDb) {
      try {
        const supabaseOnb = createServerClient(url, anonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {
              /* read-only probe */
            },
          },
        });
        const { data: row } = await supabaseOnb
          .from("agent_user_state")
          .select("onboarding_status")
          .eq("user_id", userId)
          .maybeSingle();
        const onboardingStatus = row?.onboarding_status ?? "pending";
        if (onboardingStatus === "pending") {
          const dest = request.nextUrl.clone();
          dest.pathname = "/onboarding/automation";
          return NextResponse.redirect(dest);
        }
      } catch {
        // ignore gate errors
      }
    }
  }

  if (!isPublicPath(pathname) && !hasUser && !hasGuestSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && (hasUser || hasGuestSession)) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/");
    return NextResponse.redirect(new URL(next, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
