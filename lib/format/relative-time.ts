/** Relative Korean time for UI (home banner, recent events). */
export function formatRelativeTime(
  iso: string,
  nowMs: number = Date.now()
): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffMs = nowMs - t;
  if (diffMs < 0) return "방금 전";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}
