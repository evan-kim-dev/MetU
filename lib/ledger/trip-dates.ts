import { resolveTripStartIso } from "@/lib/trips/d-day";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function addDaysIso(iso: string, days: number): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days)
  );
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** date_range 에서 "N박" 추출. 없으면 null. */
export function parseNightsFromDateRange(dateRange: string): number | null {
  const m = dateRange.match(/(\d+)\s*박/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 && n <= 60 ? n : null;
}

/**
 * start_date / end_date 가 비어 있을 때 date_range 로 추정.
 * 실패 시 null (강요하지 않음).
 */
export function suggestTripDates(
  dateRange: string,
  today?: string
): { startDate: string; endDate: string } | null {
  const start = resolveTripStartIso(dateRange, today);
  if (!start) return null;

  const nights = parseNightsFromDateRange(dateRange);
  if (nights != null) {
    const end = addDaysIso(start, nights);
    if (!end) return null;
    return { startDate: start, endDate: end };
  }

  // "7월 20일 - 7월 25일" 형태: 두 번째 월일
  const range = dateRange.match(
    /(\d{1,2})월\s*(\d{1,2})일\s*[-~–]\s*(?:(\d{1,2})월\s*)?(\d{1,2})일/
  );
  if (range) {
    const startMonth = Number(range[1]);
    const endMonth = range[3] ? Number(range[3]) : startMonth;
    const endDay = Number(range[4]);
    const y = Number(start.slice(0, 4));
    let endYear = y;
    if (endMonth < startMonth) endYear += 1;
    const end = `${endYear}-${pad(endMonth)}-${pad(endDay)}`;
    if (end < start) return null;
    return { startDate: start, endDate: end };
  }

  // ISO 두 날짜
  const isos = [...dateRange.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((x) => x[1]!);
  if (isos.length >= 2 && isos[1]! >= isos[0]!) {
    return { startDate: isos[0]!, endDate: isos[1]! };
  }

  return { startDate: start, endDate: start };
}
