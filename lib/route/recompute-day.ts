import type { TripDaySchedule, TripScheduleItem } from "@/lib/trips/types";
import type { TravelMode } from "@/lib/route/matrix/types";

export interface RecomputeOptions {
  date?: string;
  mode?: "keep-slots" | "full";
  region?: "KR" | "GLOBAL";
  travelMode?: TravelMode;
}

function timeToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function isFixedItem(item: TripScheduleItem): boolean {
  if (item.fixed) return true;
  const t = item.title.toLowerCase();
  return /체크인|체크아웃|공항|항공|비행|airport|출국|입국/.test(t);
}

function recomputeDayKeepSlots(day: TripDaySchedule): TripDaySchedule {
  const slots = day.items
    .map((i) => i.time)
    .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  const items = day.items.map((item, idx) => ({
    ...item,
    time: slots[idx] ?? item.time,
  }));
  const dayTotal = items.reduce((s, i) => s + (i.cost || 0), 0);
  return { ...day, items, dayTotal };
}

/**
 * Client-safe recompute. `mode: "full"` requires server module —
 * call from a Route Handler / server action via `recompute-day.server`.
 */
export async function recomputeDay(
  day: TripDaySchedule,
  opts?: RecomputeOptions
): Promise<TripDaySchedule> {
  const mode = opts?.mode ?? "keep-slots";
  if (mode === "full") {
    // Avoid bundling server-only deps into client components.
    console.warn(
      "[recomputeDay] full mode is server-only; falling back to keep-slots"
    );
    return recomputeDayKeepSlots(day);
  }
  return recomputeDayKeepSlots(day);
}

/**
 * 같은 일차 / 일차 간 항목 이동. fixed 항목은 원위치 반환.
 * 불변 업데이트.
 */
export function moveItem(
  days: TripDaySchedule[],
  from: { day: number; index: number },
  to: { day: number; index: number }
): TripDaySchedule[] {
  const fromDayIdx = days.findIndex((d) => d.day === from.day);
  const toDayIdx = days.findIndex((d) => d.day === to.day);
  if (fromDayIdx < 0 || toDayIdx < 0) return days;

  const source = days[fromDayIdx]!;
  if (from.index < 0 || from.index >= source.items.length) return days;

  const moving = source.items[from.index]!;
  if (isFixedItem(moving)) return days;

  const next = days.map((d) => ({
    ...d,
    items: [...d.items],
  }));

  const fromItems = next[fromDayIdx]!.items;
  const [removed] = fromItems.splice(from.index, 1);
  if (!removed) return days;

  let insertAt = to.index;
  if (from.day === to.day && to.index > from.index) {
    insertAt = to.index - 1;
  }
  insertAt = Math.max(0, Math.min(insertAt, next[toDayIdx]!.items.length));
  next[toDayIdx]!.items.splice(insertAt, 0, removed);

  return next.map((d) => ({
    ...d,
    dayTotal: d.items.reduce((s, i) => s + (i.cost || 0), 0),
  }));
}
