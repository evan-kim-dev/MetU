/** In-memory sliding window — serverless instances do not share this state. */

type WindowEntry = {
  timestamps: number[];
};

const windows = new Map<string, WindowEntry>();

function prune(timestamps: number[], cutoff: number): number[] {
  let start = 0;
  while (start < timestamps.length && timestamps[start]! < cutoff) {
    start++;
  }
  return start > 0 ? timestamps.slice(start) : timestamps;
}

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): { ok: boolean; retryAfterSec?: number } {
  const { limit, windowMs } = options;
  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = windows.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(key, entry);
  }

  entry.timestamps = prune(entry.timestamps, cutoff);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]!;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000)
    );
    return { ok: false, retryAfterSec };
  }

  entry.timestamps.push(now);

  if (windows.size > 10_000) {
    for (const [k, v] of windows) {
      const pruned = prune(v.timestamps, cutoff);
      if (pruned.length === 0) windows.delete(k);
      else v.timestamps = pruned;
      if (windows.size <= 8_000) break;
    }
  }

  return { ok: true };
}
