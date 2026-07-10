export interface ParsedTripDates {
  startDate: string;
  endDate: string;
  label: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function startFromDDay(dDay: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + Math.max(0, dDay));
  return date.toISOString().slice(0, 10);
}

function daysBetweenInclusive(
  month1: number,
  day1: number,
  month2: number,
  day2: number,
  year: number
): number {
  const start = new Date(`${year}-${pad(month1)}-${pad(day1)}T12:00:00`);
  const end = new Date(`${year}-${pad(month2)}-${pad(day2)}T12:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

export function parseTripDateRange(
  dateRange: string,
  dDay = 0
): ParsedTripDates | null {
  const label = dateRange.trim();
  if (!label) return null;

  const rangeMatch = label.match(
    /(\d{1,2})월\s*(\d{1,2})일\s*-\s*(?:(\d{1,2})월\s*)?(\d{1,2})일/
  );
  if (rangeMatch) {
    const month1 = Number(rangeMatch[1]);
    const day1 = Number(rangeMatch[2]);
    const month2 = Number(rangeMatch[3] ?? rangeMatch[1]);
    const day2 = Number(rangeMatch[4]);
    const startDate = startFromDDay(dDay);
    const year = Number(startDate.slice(0, 4));
    const tripDays = daysBetweenInclusive(month1, day1, month2, day2, year);
    return {
      startDate,
      endDate: addDays(startDate, tripDays - 1),
      label,
    };
  }

  const nightsMatch = label.match(/(\d+)박/);
  if (nightsMatch) {
    const nights = Number(nightsMatch[1]);
    const startDate = startFromDDay(dDay);
    return {
      startDate,
      endDate: addDays(startDate, nights),
      label,
    };
  }

  const yearMonthMatch = label.match(/(\d{4})년\s*(\d{1,2})월/);
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);
    const startDate = toIsoDate(year, month, 12);
    const endDate = toIsoDate(year, month, 18);
    return { startDate, endDate, label };
  }

  if (dDay > 0) {
    const startDate = startFromDDay(dDay);
    return {
      startDate,
      endDate: addDays(startDate, 2),
      label,
    };
  }

  return null;
}

export function enumerateIsoDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}
