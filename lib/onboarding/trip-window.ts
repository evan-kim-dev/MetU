/** Trip date window helpers for attaching unassigned agent events. */

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDateOnly(iso: string): Date | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Use UTC noon to avoid DST edge cases when shifting calendar days.
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}

/** Asia/Seoul calendar Y-M-D for an instant. */
export function seoulDateIso(instant: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(instant);
}

/**
 * Inclusive window with ±slackDays around [startDate, endDate] (YYYY-MM-DD).
 * Bounds are Asia/Seoul local midnights converted to UTC instants.
 */
export function tripWindowBounds(
  startDate: string,
  endDate: string | null | undefined,
  slackDays = 1
): { startMs: number; endMs: number } | null {
  const start = parseIsoDateOnly(startDate);
  if (!start) return null;
  const endRaw = endDate && endDate.trim() ? endDate : startDate;
  const end = parseIsoDateOnly(endRaw);
  if (!end) return null;
  if (end.getTime() < start.getTime()) return null;

  const slack = Math.max(0, Math.floor(slackDays));
  const windowStart = new Date(start.getTime() - slack * DAY_MS);
  const windowEnd = new Date(end.getTime() + slack * DAY_MS);

  // Interpret calendar dates as Asia/Seoul day bounds via offset string.
  const startIso = `${windowStart.getUTCFullYear()}-${String(windowStart.getUTCMonth() + 1).padStart(2, "0")}-${String(windowStart.getUTCDate()).padStart(2, "0")}`;
  const endIso = `${windowEnd.getUTCFullYear()}-${String(windowEnd.getUTCMonth() + 1).padStart(2, "0")}-${String(windowEnd.getUTCDate()).padStart(2, "0")}`;

  const startMs = Date.parse(`${startIso}T00:00:00+09:00`);
  const endMs = Date.parse(`${endIso}T23:59:59.999+09:00`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  return { startMs, endMs };
}

export function isInstantInTripWindow(
  receivedAtMs: number,
  startDate: string,
  endDate: string | null | undefined,
  slackDays = 1
): boolean {
  const bounds = tripWindowBounds(startDate, endDate, slackDays);
  if (!bounds) return false;
  return receivedAtMs >= bounds.startMs && receivedAtMs <= bounds.endMs;
}

export type TripDateCandidate = {
  id: string;
  startDate: string;
  endDate: string | null;
};

/**
 * Prefer the trip whose startDate is closest to receivedAt (among matches).
 * Returns null when none match.
 */
export function pickTripIdForReceivedAt(
  candidates: TripDateCandidate[],
  receivedAtMs: number,
  slackDays = 1
): string | null {
  const matching = candidates.filter((c) =>
    isInstantInTripWindow(receivedAtMs, c.startDate, c.endDate, slackDays)
  );
  if (matching.length === 0) return null;

  let best = matching[0]!;
  let bestDist = Math.abs(
    (parseIsoDateOnly(best.startDate)?.getTime() ?? 0) - receivedAtMs
  );
  for (let i = 1; i < matching.length; i++) {
    const c = matching[i]!;
    const start = parseIsoDateOnly(c.startDate)?.getTime() ?? 0;
    const dist = Math.abs(start - receivedAtMs);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best.id;
}

export function parseReceivedAtMs(
  payload: Record<string, unknown> | null | undefined,
  fallbackIso: string
): number {
  const raw =
    (typeof payload?.received_at === "string" && payload.received_at) ||
    (typeof payload?.receivedAt === "string" && payload.receivedAt) ||
    fallbackIso;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    const fb = Date.parse(fallbackIso);
    return Number.isNaN(fb) ? Date.now() : fb;
  }
  return ms;
}
