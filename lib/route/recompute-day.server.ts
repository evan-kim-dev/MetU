import "server-only";

import type { OpeningPeriod } from "@/lib/places/types";
import type { TripDaySchedule, TripScheduleItem } from "@/lib/trips/types";
import {
  defaultDayConstraints,
  durationMinForKind,
  evaluateOrder,
  solveDay,
  type SolverStop,
} from "@/lib/route/schedule-solver";
import {
  isFixedItem,
  type RecomputeOptions,
} from "@/lib/route/recompute-day";
import { getPlacesByIds } from "@/lib/places/cache";
import {
  getTravelMatrix,
  refineLegsForOrder,
} from "@/lib/route/travel-matrix";

const REFINE_RESOLVE_THRESHOLD = 0.2;

function timeToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function weekdayFromIso(date?: string): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return null;
  return d.getDay();
}

function openingForDay(
  periods: OpeningPeriod[] | undefined,
  weekday: number | null
): Array<{ open: string; close: string }> | undefined {
  if (!periods?.length) return undefined;
  if (weekday == null) {
    return periods.map((p) => ({ open: p.open, close: p.close }));
  }
  const dayPeriods = periods.filter((p) => p.day === weekday);
  if (!dayPeriods.length) return [];
  return dayPeriods.map((p) => ({ open: p.open, close: p.close }));
}

function totalTravelMinFromMatrix(
  order: number[],
  durationsSec: number[][]
): number {
  let sec = 0;
  for (let k = 0; k < order.length - 1; k++) {
    sec += durationsSec[order[k]!]?.[order[k + 1]!] ?? 0;
  }
  return sec / 60;
}

function reorderItems(
  day: TripDaySchedule,
  orderedIds: string[],
  timetableById: Map<
    string,
    {
      arrive: string;
      travelFromPrevMin: number;
      warnings: TripScheduleItem["warnings"];
    }
  >
): TripScheduleItem[] {
  const byId = new Map<string, TripScheduleItem>();
  for (const item of day.items) {
    byId.set(item.placeId ?? item.title, item);
  }

  const used = new Set<string>();
  const next: TripScheduleItem[] = [];

  for (const id of orderedIds) {
    const item = byId.get(id);
    if (!item) continue;
    used.add(id);
    const tt = timetableById.get(id);
    next.push({
      ...item,
      time: tt?.arrive ?? item.time,
      travelFromPrevMin: tt?.travelFromPrevMin,
      warnings: tt?.warnings?.length ? tt.warnings : undefined,
    });
  }

  for (const item of day.items) {
    const key = item.placeId ?? item.title;
    if (used.has(key)) continue;
    if (isFixedItem(item)) {
      next.push(item);
      continue;
    }
    next.push({ ...item });
  }

  return next.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
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

/** Server-only full recompute (places cache + travel matrix). */
export async function recomputeDayFull(
  day: TripDaySchedule,
  opts: RecomputeOptions = {}
): Promise<TripDaySchedule> {
  type MatrixPoint = { id: string; lat: number; lng: number };

  const region = opts.region ?? "GLOBAL";
  const mode = opts.travelMode ?? "TRANSIT";
  const weekday = weekdayFromIso(opts.date);

  const candidates = day.items.filter(
    (item) =>
      !isFixedItem(item) &&
      typeof item.lat === "number" &&
      typeof item.lng === "number"
  );

  const movableTotal = day.items.filter((i) => !isFixedItem(i)).length;
  if (candidates.length < 2 || candidates.length < movableTotal * 0.5) {
    return recomputeDayKeepSlots(day);
  }

  const placeIds = candidates
    .map((i) => i.placeId)
    .filter((id): id is string => Boolean(id));
  const places = placeIds.length ? await getPlacesByIds(placeIds) : [];
  const placeById = new Map(places.map((p) => [p.id, p]));

  const stops: SolverStop[] = candidates.map((item) => {
    const place = item.placeId ? placeById.get(item.placeId) : undefined;
    const opening = openingForDay(place?.openingHours, weekday);
    const hoursKnown =
      place != null
        ? Boolean(place.openingHours?.length)
        : item.hoursKnown !== false && Boolean(opening?.length);

    return {
      id: item.placeId ?? item.title,
      lat: item.lat!,
      lng: item.lng!,
      kind: item.kind ?? place?.kind ?? "other",
      durationMin: durationMinForKind(
        item.kind ?? place?.kind ?? "other",
        item.durationMin
      ),
      opening,
      hoursKnown: hoursKnown ? true : false,
      fixed: isFixedItem(item) ? { at: item.time } : undefined,
    };
  });

  const points: MatrixPoint[] = stops.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
  }));

  let matrix = await getTravelMatrix(points, mode, { region });
  const constraints = defaultDayConstraints();

  let plan = solveDay(stops, matrix.durationsSec, constraints);

  const indexOrder = plan.order.map((id) =>
    stops.findIndex((s) => s.id === id)
  );

  if (region === "KR") {
    const refined = await refineLegsForOrder(
      matrix,
      points,
      indexOrder.filter((i) => i >= 0)
    );
    const beforeTravel = totalTravelMinFromMatrix(
      indexOrder.filter((i) => i >= 0),
      matrix.durationsSec
    );
    const afterTravel = totalTravelMinFromMatrix(
      indexOrder.filter((i) => i >= 0),
      refined.durationsSec
    );
    matrix = refined;
    let evaluated = evaluateOrder(
      indexOrder.filter((i) => i >= 0),
      stops,
      matrix.durationsSec,
      constraints
    );
    if (
      beforeTravel > 0 &&
      Math.abs(afterTravel - beforeTravel) / beforeTravel >
        REFINE_RESOLVE_THRESHOLD
    ) {
      plan = solveDay(stops, matrix.durationsSec, constraints);
      evaluated = evaluateOrder(
        plan.order.map((id) => stops.findIndex((s) => s.id === id)),
        stops,
        matrix.durationsSec,
        constraints
      );
    } else {
      plan = {
        ...plan,
        timetable: evaluated.timetable,
        totalTravelMin: Math.round(
          evaluated.timetable.reduce((s, t) => s + t.travelFromPrevMin, 0)
        ),
        totalViolations: evaluated.violations,
      };
    }
  }

  const timetableById = new Map<
    string,
    {
      arrive: string;
      travelFromPrevMin: number;
      warnings: TripScheduleItem["warnings"];
    }
  >();
  for (const entry of plan.timetable) {
    timetableById.set(entry.stopId, {
      arrive: entry.arrive,
      travelFromPrevMin: entry.travelFromPrevMin,
      warnings: entry.violations.length ? entry.violations : undefined,
    });
  }

  const items = reorderItems(day, plan.order, timetableById);
  const dayTotal = items.reduce((s, i) => s + (i.cost || 0), 0);
  return { ...day, items, dayTotal };
}
