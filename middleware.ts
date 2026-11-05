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
  /** 실제(비익명) Supabase 로그인 세션 */
  hasUser: boolean;
  /** 익명 Supabase 세션 (게스트 합류 등) */
  hasAnonymousUser: boolean;
  /** 서명된 게스트 쿠키 */
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
  let hasAnonymousUser = false;

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
      const user =
        result && "data" in result ? result.data.user : null;
      if (user?.id) {
        if (user.is_anonymous) {
          hasAnonymousUser = true;
        } else {
          hasUser = true;
        }
      }
    } catch {
      // ignore and continue
    }
  }

  return { response, hasUser, hasAnonymousUser, hasGuestSession };
}

/**
 * 라우트 3단 분기:
 * 1) Public — 인증 없이 통과 (`/`, `/login`, `/s/*`, 공개 API …)
 * 2) Auth (`/login`) — 실제 로그인만 홈으로 보내고, 게스트 쿠키만 있으면 폼 허용
 * 3) Protected — 세션(실유저·익명·게스트 쿠키) 없으면 `/login?next=`
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // PWA/정적: getUser 생략
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

  const { response, hasUser, hasAnonymousUser, hasGuestSession } =
    await resolveAuth(request);
  const hasAnySession = hasUser || hasAnonymousUser || hasGuestSession;

  // 1) 공개 API
  if (pathname.startsWith("/api/")) {
    if (isPublicApiPath(pathname)) {
      return response;
    }
    if (!hasAnySession) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return response;
  }

  // 2) /login — 실제 로그인만 리다이렉트 (게스트·익명은 폼 허용)
  if (pathname === "/login") {
    if (hasUser) {
      const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/");
      return NextResponse.redirect(new URL(next, request.url));
    }
    return response;
  }

  if (pathname === "/auth/logout") {
    return response;
  }

  // 1) 공개 페이지
  if (isPublicPath(pathname)) {
    return response;
  }

  // 3) 보호 라우트
  if (!hasAnySession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
