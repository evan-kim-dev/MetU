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

  // 전체 날짜 두 개 또는 끝 연도 생략: "2026-07-20 ~ 2026-07-25", "2026.08.01~08.05"
  const full = dateRange.match(
    /(\d{4})[-./](\d{1,2})[-./](\d{1,2})\s*[-~–—]\s*(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/
  );
  if (full) {
    const startYear = Number(full[1]);
    let endYear = full[4] ? Number(full[4]) : startYear;
    const end = `${endYear}-${pad(Number(full[5]))}-${pad(Number(full[6]))}`;
    if (end < start && !full[4]) {
      // "12.30~01.03" 처럼 해를 넘기는 경우
      endYear += 1;
      const wrapped = `${endYear}-${pad(Number(full[5]))}-${pad(Number(full[6]))}`;
      return { startDate: start, endDate: wrapped };
    }
    if (end >= start) return { startDate: start, endDate: end };
    // 끝이 시작보다 앞서는 입력은 믿지 않고 시작일 하루로 둔다.
  }

  // "2026년 8월 중순" (박 수 없음): 그 달의 해당 순(초 1~10 / 중순 11~20 / 말 21~말일)
  const period = dateRange.match(/(\d{4})년\s*(\d{1,2})월\s*(초|중순|말)/);
  if (period) {
    const y = Number(period[1]);
    const mo = Number(period[2]);
    const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const [from, to] =
      period[3] === "초" ? [1, 10] : period[3] === "중순" ? [11, 20] : [21, lastDay];
    return {
      startDate: `${y}-${pad(mo)}-${pad(from)}`,
      endDate: `${y}-${pad(mo)}-${pad(to)}`,
    };
  }

  return { startDate: start, endDate: start };
}
