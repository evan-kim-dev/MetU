import { safeNextPath } from "@/lib/security/safe-next";

const PUBLIC_PATH_PREFIXES = ["/login", "/legal", "/about"] as const;

const STATIC_PUBLIC_EXACT = new Set([
  "/sw.js",
  "/site.webmanifest",
  "/offline.html",
  "/manifest.webmanifest",
  "/robots.txt",
]);

/**
 * Paths that skip auth redirects and must not hit getUser().
 */
export function isPublicPath(pathname: string): boolean {
  if (STATIC_PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/.well-known/")) return true;
  if (
    PUBLIC_PATH_PREFIXES.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  ) {
    return true;
  }
  return (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/trips/share/") ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/share-target")
  );
}

/**
 * Pending automation onboarding gate exemptions.
 * Includes exact `/onboarding` (trip planner) — previously only `/onboarding/` prefix.
 */
export function isGateExempt(pathname: string): boolean {
  if (pathname === "/onboarding") return true;
  if (pathname.startsWith("/onboarding/")) return true;
  if (pathname === "/login" || pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/legal")) return true;
  if (pathname === "/about" || pathname.startsWith("/about/")) return true;
  if (pathname.startsWith("/join/")) return true;
  if (pathname.startsWith("/share-target")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/s/") || pathname.startsWith("/trips/share/")) {
    return true;
  }
  if (STATIC_PUBLIC_EXACT.has(pathname)) return true;
  if (pathname === "/agent/inbox" || pathname.startsWith("/agent/inbox/")) {
    return true;
  }
  return false;
}

function shouldAttachNext(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return false;
  if (
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api")
  ) {
    return false;
  }
  return true;
}

/**
 * Redirect pending users to automation with gate=1 and a safe next path.
 * Does not copy arbitrary query params from the original URL.
 */
export function buildGateRedirect(
  requestUrl: URL,
  origin: string
): URL {
  const dest = new URL("/onboarding/automation", origin);
  dest.searchParams.set("gate", "1");

  const pathname = requestUrl.pathname;
  const search = requestUrl.search || "";
  if (shouldAttachNext(pathname)) {
    const candidate = `${pathname}${search}`;
    const next = safeNextPath(candidate, "");
    if (next && next !== "/") {
      dest.searchParams.set("next", next);
    }
  }
  return dest;
}
