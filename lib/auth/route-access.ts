/**
 * 로그인 없이 열리는 경로의 단일 출처.
 * middleware(서버)와 AuthGate(클라이언트)가 같은 목록을 써서 어긋나지 않게 한다.
 */

/** 로그인 없이 열리는 화면(페이지) 경로 prefix. */
const PUBLIC_PAGE_PREFIXES = [
  "/login",
  "/legal",
  "/about",
  "/auth",
  "/s",
  "/trips/share",
] as const;

const STATIC_PUBLIC_EXACT = new Set([
  "/sw.js",
  "/site.webmanifest",
  "/offline.html",
  "/manifest.webmanifest",
  "/robots.txt",
]);

/**
 * 공개 "화면" 경로 여부. 정적 자산/공유 타깃은 포함하지 않는다.
 * AuthGate(클라이언트)가 사용한다.
 */
export function isPublicPagePath(pathname: string): boolean {
  return PUBLIC_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Paths that skip auth redirects and must not hit getUser().
 * middleware(서버)가 사용한다.
 */
export function isPublicPath(pathname: string): boolean {
  if (STATIC_PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/.well-known/")) return true;
  if (isPublicPagePath(pathname)) return true;
  return pathname.startsWith("/share-target");
}
