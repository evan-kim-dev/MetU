import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE, verifyGuestCookie } from "@/lib/auth/guest-cookie";
import { isPublicPath } from "@/lib/auth/route-access";
import { resolveGuestCookieSecret } from "@/lib/security/guest-secret";
import { isPublicApiPath } from "@/lib/security/public-api";
import { safeNextPath } from "@/lib/security/safe-next";
import { getPublicSupabaseKey } from "@/lib/supabase/env";

async function resolveAuth(request: NextRequest): Promise<{
  response: NextResponse;
  hasUser: boolean;
  hasGuestSession: boolean;
}> {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const guestSecret = resolveGuestCookieSecret();
  const guestVerified = await verifyGuestCookie(
    request.cookies.get(GUEST_COOKIE)?.value,
    guestSecret
  );
  const hasGuestSession = guestVerified.ok;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getPublicSupabaseKey();

  let hasUser = false;

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
      }
    } catch {
      // ignore and continue
    }
  }

  return { response, hasUser, hasGuestSession };
}

/**
 * Page auth + API whitelist.
 * Non-public /api/* requires a signed-in user or signed guest cookie.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public/static paths: skip getUser (PWA assets must not redirect to /login).
  if (isPublicPath(pathname) && pathname !== "/login") {
    if (
      pathname === "/sw.js" ||
      pathname === "/site.webmanifest" ||
      pathname === "/offline.html" ||
      pathname === "/manifest.webmanifest" ||
      pathname === "/robots.txt" ||
      pathname.startsWith("/.well-known/")
    ) {
      return NextResponse.next({
        request: { headers: request.headers },
      });
    }
  }

  if (pathname === "/login" || pathname === "/auth/logout") {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  const { response, hasUser, hasGuestSession } =
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

  if (!isPublicPath(pathname) && !hasUser && !hasGuestSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Unreachable for /login early-return above; kept for auth callback edge cases
  // where pathname could still be /login after resolveAuth without early exit.
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
