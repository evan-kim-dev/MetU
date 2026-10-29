import "server-only";

import type { TravelMatrix, TravelMode } from "@/lib/route/matrix/types";

const MAX_ENTRIES = 200;
const TTL_MS = 30 * 60 * 1000;

type CacheEntry = { matrix: TravelMatrix; expiresAt: number };
const lru = new Map<string, CacheEntry>();

function roundCoord(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function matrixCacheKey(
  points: Array<{ lat: number; lng: number }>,
  mode: TravelMode,
  region: "KR" | "GLOBAL",
  timeBucket?: string
): string {
  const coords = points
    .map((p) => `${roundCoord(p.lat)},${roundCoord(p.lng)}`)
    .join("|");
  return `${region}|${mode}|${timeBucket ?? "none"}|${coords}`;
}

export function getCachedMatrix(key: string): TravelMatrix | null {
  const entry = lru.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    lru.delete(key);
    return null;
  }
  lru.delete(key);
  lru.set(key, entry);
  return entry.matrix;
}

export function setCachedMatrix(key: string, matrix: TravelMatrix): void {
  if (lru.has(key)) lru.delete(key);
  lru.set(key, { matrix, expiresAt: Date.now() + TTL_MS });
  while (lru.size > MAX_ENTRIES) {
    const oldest = lru.keys().next().value;
    if (oldest === undefined) break;
    lru.delete(oldest);
  }
}

/** 테스트용 */
export function clearMatrixCache(): void {
  lru.clear();
}
