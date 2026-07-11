import type { DaySchedule } from "@/lib/ai/types";
import {
  buildDistanceMatrix,
  pathLengthKm,
} from "@/lib/route/distance";
import { optimizeRouteGenetic } from "@/lib/route/genetic";
import {
  createGeocodeCache,
  createGeocodeInflight,
  geocodePlaceQuery,
  isFixedScheduleTitle,
} from "@/lib/route/geocode";
import type {
  DayRouteOptimizeResult,
  LatLng,
  ScheduleOptimizeResult,
} from "@/lib/route/types";

type LocatedItem = {
  index: number;
  title: string;
  fixed: boolean;
  point: LatLng | null;
};

async function locateDayItems(
  day: DaySchedule,
  destination: string,
  country: string,
  cache: ReturnType<typeof createGeocodeCache>,
  inflight: ReturnType<typeof createGeocodeInflight>
): Promise<LocatedItem[]> {
  return Promise.all(
    day.items.map(async (item, index) => {
      const fixed = isFixedScheduleTitle(item.title);
      const point = fixed
        ? null
        : await geocodePlaceQuery(
            item.title,
            destination,
            country,
            cache,
            inflight
          );
      return {
        index,
        title: item.title,
        fixed: fixed || !point,
        point,
      };
    })
  );
}

function reconstructOrder(
  located: LocatedItem[],
  movablePermutation: number[]
): number[] {
  const movableQueue = [...movablePermutation];
  const result: number[] = [];
  for (const item of located) {
    if (item.fixed || !item.point) {
      result.push(item.index);
    } else {
      result.push(movableQueue.shift()!);
    }
  }
  return result;
}

function sequenceLength(order: number[], located: LocatedItem[]): number {
  const points: LatLng[] = [];
  for (const idx of order) {
    const point = located[idx]?.point;
    if (!point) continue;
    points.push(point);
  }
  if (points.length < 2) return 0;
  const matrix = buildDistanceMatrix(points);
  const path = points.map((_, i) => i);
  return pathLengthKm(path, matrix);
}

function optimizeLocatedDay(
  day: DaySchedule,
  located: LocatedItem[]
): DayRouteOptimizeResult {
  const movable = located.filter((item) => item.point && !item.fixed);
  const originalOrder = located.map((item) => item.index);
  const before = sequenceLength(originalOrder, located);

  if (movable.length < 2) {
    return {
      day: day.day,
      order: originalOrder,
      totalKmBefore: before,
      totalKmAfter: before,
      optimized: false,
    };
  }

  const matrixPoints = movable.map((m) => m.point!);
  const matrix = buildDistanceMatrix(matrixPoints);
  const { order: localOrder } = optimizeRouteGenetic(
    matrixPoints.length,
    matrix
  );
  const movablePermutation = localOrder.map((i) => movable[i].index);
  const nextOrder = reconstructOrder(located, movablePermutation);
  const after = sequenceLength(nextOrder, located);

  if (after > before + 0.05) {
    return {
      day: day.day,
      order: originalOrder,
      totalKmBefore: before,
      totalKmAfter: before,
      optimized: false,
    };
  }

  return {
    day: day.day,
    order: nextOrder,
    totalKmBefore: before,
    totalKmAfter: after,
    optimized: after + 0.05 < before,
  };
}

function applyDayOrder(day: DaySchedule, order: number[]): DaySchedule {
  const times = day.items.map((item) => item.time);
  const reordered = order.map((idx) => day.items[idx]);
  const items = reordered.map((item, i) => ({
    ...item,
    time: times[i] ?? item.time,
  }));
  return { ...day, items };
}

/**
 * Optimize each day's POI order with a genetic algorithm (open-path TSP).
 * Fixed items (check-in/out, airport) keep their slots; times stay chronological.
 */
export async function optimizeDailyScheduleRoutes(
  schedule: DaySchedule[],
  destination: string,
  country: string
): Promise<{ schedule: DaySchedule[]; meta: ScheduleOptimizeResult }> {
  const cache = createGeocodeCache();
  const inflight = createGeocodeInflight();

  const optimizedDays = await Promise.all(
    schedule.map(async (day) => {
      try {
        const located = await locateDayItems(
          day,
          destination,
          country,
          cache,
          inflight
        );
        const result = optimizeLocatedDay(day, located);
        const changed = result.order.some((v, i) => v !== i);
        return {
          result,
          day: changed ? applyDayOrder(day, result.order) : day,
        };
      } catch {
        return {
          result: {
            day: day.day,
            order: day.items.map((_, i) => i),
            totalKmBefore: 0,
            totalKmAfter: 0,
            optimized: false,
          } satisfies DayRouteOptimizeResult,
          day,
        };
      }
    })
  );

  const dayResults = optimizedDays.map((d) => d.result);
  const nextSchedule = optimizedDays.map((d) => d.day);
  const totalKmBefore = dayResults.reduce((s, d) => s + d.totalKmBefore, 0);
  const totalKmAfter = dayResults.reduce((s, d) => s + d.totalKmAfter, 0);
  const savedKm = Math.max(0, totalKmBefore - totalKmAfter);
  const applied = dayResults.some((d) => d.optimized);

  return {
    schedule: nextSchedule,
    meta: {
      applied,
      method: "genetic",
      savedKm: Number(savedKm.toFixed(2)),
      totalKmBefore: Number(totalKmBefore.toFixed(2)),
      totalKmAfter: Number(totalKmAfter.toFixed(2)),
      days: dayResults,
    },
  };
}
