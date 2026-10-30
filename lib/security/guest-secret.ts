/**
 * Edge-safe guest cookie secret resolution (no Node-only APIs).
 * Dev fallback matches historical middleware / identity / guest route behavior.
 */
export function resolveGuestCookieSecret(
  env: { GUEST_COOKIE_SECRET?: string; NODE_ENV?: string } = process.env
): string {
  const fromEnv = env.GUEST_COOKIE_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (env.NODE_ENV !== "production") {
    return "dev-guest-cookie-secret";
  }
  return "";
}
