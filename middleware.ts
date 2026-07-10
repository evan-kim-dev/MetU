import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE, isGuestCookie } from "@/lib/auth/guest-session";
import { getPublicSupabaseKey } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/legal"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    ) || pathname.startsWith("/auth/")
  );
}

/**
 * Keep auth cookies fresh on every request.
 * Uses a short timeout so local/dev does not hang when auth network is slow.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/auth/logout") {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const hasGuestSession = isGuestCookie(request.cookies.get(GUEST_COOKIE)?.value);

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
      hasUser = Boolean(
        result && "data" in result && result.data.user
      );
    } catch {
      // ignore and continue
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
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
