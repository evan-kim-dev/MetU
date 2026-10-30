/**
 * API routes that may run without a Supabase user / guest session.
 * Each still has its own auth (ingest token, CRON_SECRET, or is read-only public).
 */
const PUBLIC_API_PREFIXES = [
  "/api/ingest/",
  "/api/auth/guest",
  "/api/warmup",
  "/api/fx",
  "/api/destination-image",
  "/api/places/autocomplete",
  "/api/onboarding/session",
  "/api/trip-tips",
  "/api/share-target",
  "/api/agent/sweep",
  "/api/agent/cron/",
] as const;

export function isPublicApiPath(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix)
  );
}
