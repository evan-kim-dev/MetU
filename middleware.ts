import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE, verifyGuestCookie } from "@/lib/auth/guest-cookie";
import {
  MTU_ONB_COOKIE,
  MTU_ONB_SKIP_STATUSES,
} from "@/lib/onboarding/constants";
import { isPublicApiPath } from "@/lib/security/public-api";
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

async function resolveAuth(request: NextRequest): Promise<{
  response: NextResponse;
  hasUser: boolean;
  userId: string | null;
  hasGuestSession: boolean;
}> {
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

  return { response, hasUser, userId, hasGuestSession };
}

/**
 * Page auth + API whitelist.
 * Non-public /api/* requires a signed-in user or signed guest cookie.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/auth/logout") {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  const { response, hasUser, userId, hasGuestSession } =
    await resolveAuth(request);

  if (pathname.startsWith("/api/")) {
    if (isPublicApiPath(pathname)) {
      return response;
    }
    if (!hasUser && !hasGuestSession) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return response;
  }

  if (
    hasUser &&
    userId &&
    !hasGuestSession &&
    !isAutomationOnboardingExcluded(pathname)
  ) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = getPublicSupabaseKey();
    const onbHint = request.cookies.get(MTU_ONB_COOKIE)?.value;
    const skipDb =
      onbHint != null &&
      MTU_ONB_SKIP_STATUSES.has(onbHint as "done" | "partial" | "skipped");

    if (!skipDb && url && anonKey) {
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
