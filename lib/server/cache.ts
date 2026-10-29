import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";

export type CacheHit = "fresh" | "stale" | "miss";

export type CacheResult<T> = {
  value: T;
  hit: CacheHit;
  fetchedAt: string;
};

type CacheRow = {
  key: string;
  value: unknown;
  fetched_at: string;
  expires_at: string;
};

/**
 * Supabase `api_cache` get-or-set (no in-memory cache — serverless).
 * Expired rows may still be returned when `staleIfError` and `fn` throws.
 */
export async function getOrSet<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>,
  options: { staleIfError?: boolean } = {}
): Promise<CacheResult<T>> {
  const admin = getAgentAdmin();
  const now = Date.now();

  if (admin) {
    const { data } = await admin
      .from("api_cache")
      .select("key,value,fetched_at,expires_at")
      .eq("key", key)
      .maybeSingle();

    const row = data as CacheRow | null;
    if (row) {
      const expiresAt = new Date(row.expires_at).getTime();
      if (expiresAt > now) {
        return {
          value: row.value as T,
          hit: "fresh",
          fetchedAt: row.fetched_at,
        };
      }

      try {
        const value = await fn();
        const fetchedAt = new Date().toISOString();
        const expiresAtIso = new Date(now + Math.max(1, ttlSec) * 1000).toISOString();
        await admin.from("api_cache").upsert({
          key,
          value,
          fetched_at: fetchedAt,
          expires_at: expiresAtIso,
        });
        return { value, hit: "miss", fetchedAt };
      } catch (err) {
        if (options.staleIfError) {
          return {
            value: row.value as T,
            hit: "stale",
            fetchedAt: row.fetched_at,
          };
        }
        throw err;
      }
    }
  }

  const value = await fn();
  const fetchedAt = new Date().toISOString();
  if (admin) {
    const expiresAtIso = new Date(now + Math.max(1, ttlSec) * 1000).toISOString();
    await admin.from("api_cache").upsert({
      key,
      value,
      fetched_at: fetchedAt,
      expires_at: expiresAtIso,
    });
  }
  return { value, hit: "miss", fetchedAt };
}
