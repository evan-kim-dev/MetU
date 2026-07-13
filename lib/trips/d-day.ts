import { todayIsoDate } from "@/lib/shared/dates";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 오늘(로컬) 정오 기준 대상일까지 남은 일수 (음수면 지난 날짜) */
export function daysUntilIso(isoDate: string, today = todayIsoDate()): number {
  const target = new Date(`${isoDate}T12:00:00`);
  const base = new Date(`${today}T12:00:00`);
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

/**
 * dateRange 문자열에서 출발일(ISO)을 추론한다.
 * - `2026-07-20 ...`
 * - `2026년 8월 중순 · 5박 ...`
 * - `7월 20일 - 7월 25일` (연도 없으면 오늘 기준 다가오는 날짜)
 */
export function resolveTripStartIso(
  dateRange: string,
  today = todayIsoDate()
): string | null {
  const label = dateRange.trim();
  if (!label) return null;

  const isoMatch = label.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const yearMonthMatch = label.match(/(\d{4})년\s*(\d{1,2})월/);
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);
    let day = 12;
    if (label.includes("초")) day = 5;
    else if (label.includes("중순")) day = 15;
    else if (label.includes("말")) day = 25;
    return toIso(year, month, day);
  }

  const mdMatch = label.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (mdMatch) {
    const month = Number(mdMatch[1]);
    const day = Number(mdMatch[2]);
    const [ty] = today.split("-").map(Number);
    let year = ty;
    const candidate = toIso(year, month, day);
    // 이미 지난 날짜면 다음 해로 (예정 여행 가정)
    if (candidate < today) {
      year += 1;
    }
    return toIso(year, month, day);
  }

  return null;
}

/** dateRange 기준 실제 남은 D-day (오늘이면 0). 파싱 실패 시 fallback */
export function computeTripDDay(
  dateRange: string,
  fallbackDDay = 0,
  today = todayIsoDate()
): number {
  const start = resolveTripStartIso(dateRange, today);
  if (!start) return Math.max(0, fallbackDDay);
  return Math.max(0, daysUntilIso(start, today));
}

export function formatTripDDayLabel(dDay: number): string {
  if (dDay <= 0) return "D-Day";
  return `D-${dDay}`;
}
