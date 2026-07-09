/**
 * Environment helpers.
 * - Public keys: NEXT_PUBLIC_* (browser-safe)
 * - Secrets: never use NEXT_PUBLIC_ ; keep in FastAPI backend
 *
 * NOTE:
 * In Next.js client bundles, dynamic env access (process.env[name]) may not be
 * replaced reliably. Use static references for NEXT_PUBLIC_* keys.
 */

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const BACKEND_URL = process.env.BACKEND_URL?.trim();

function requirePublic(name: string, value?: string): string {
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Supabase v2 supports both anon and publishable key naming.
 * Prefer publishable when present, fallback to anon for compatibility.
 */
export function getPublicSupabaseKey(): string {
  return NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function getPublicSupabaseEnv() {
  const url = requirePublic("NEXT_PUBLIC_SUPABASE_URL", NEXT_PUBLIC_SUPABASE_URL);
  const key = getPublicSupabaseKey();
  if (!key) {
    throw new Error(
      "[config] Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return { url, anonKey: key };
}

/** Optional during gradual rollout — prefers fail-soft in UI when unset. */
export function tryGetPublicSupabaseEnv():
  | { url: string; anonKey: string }
  | null {
  const url = NEXT_PUBLIC_SUPABASE_URL;
  const key = getPublicSupabaseKey();
  if (!url || !key) return null;
  return { url, anonKey: key };
}

export function getBackendUrl(): string {
  return BACKEND_URL || "http://127.0.0.1:8000";
}
