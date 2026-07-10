/** Canonical production origin — never land OAuth on a stale preview deployment. */
export const PRODUCTION_SITE_URL = "https://met-u.vercel.app";

export function resolveSiteOrigin(fallbackOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  if (fallbackOrigin) {
    try {
      const url = new URL(fallbackOrigin);
      // Any *.vercel.app host (including old preview aliases) → canonical prod
      if (
        url.hostname === "met-u.vercel.app" ||
        url.hostname.endsWith("-evan-s.vercel.app") ||
        url.hostname === "met-u-evan-s.vercel.app"
      ) {
        return PRODUCTION_SITE_URL;
      }
      return url.origin;
    } catch {
      /* ignore */
    }
  }

  return PRODUCTION_SITE_URL;
}
