import { optimizeRouteGenetic } from "@/lib/route/genetic";
import type { PlaceKind } from "@/lib/places/types";
import { estimateLeg } from "@/lib/route/matrix/haversine";
import type { TravelMode } from "@/lib/route/matrix/types";

const ANCHOR_TRAVEL_MODE: TravelMode = "TRANSIT";

export interface SolverStop {
  id: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  durationMin: number;
  /** 해당 요일 영업 구간. undefined = 미상 */
  opening?: Array<{ open: string; close: string }>;
  hoursKnown?: boolean;
  fixed?: { at: string };
}

export interface DayConstraints {
  dayStart: string;
  dayEnd: string;
  start?: { lat: number; lng: number };
  end?: { lat: number; lng: number };
  lunchWindow: [string, string];
  dinnerWindow: [string, string];
}

export type Violation =
  | "closed"
  | "after-day-end"
  | "meal-outside-window"
  | "fixed-missed";

export interface TimetableEntry {
  stopId: string;
  arrive: string;
  depart: string;
  travelFromPrevMin: number;
  waitMin: number;
  hoursUnknown: boolean;
  violations: Violation[];
}

export interface DayPlan {
  order: string[];
  timetable: TimetableEntry[];
  totalTravelMin: number;
  totalViolations: number;
  usedFallback: boolean;
}

/** kind 별 기본 영업 가정 — 소프트 패널티용, 하드 closed 아님 */
export const DEFAULT_HOURS: Record<
  PlaceKind,
  { open: string; close: string }
> = {
  attraction: { open: "09:00", close: "18:00" },
  food: { open: "11:00", close: "21:00" },
  cafe: { open: "09:00", close: "22:00" },
  shopping: { open: "10:00", close: "21:00" },
  lodging: { open: "00:00", close: "24:00" },
  transport: { open: "00:00", close: "24:00" },
  other: { open: "09:00", close: "21:00" },
};

export const PENALTY = {
  closed: 1000,
  "fixed-missed": 1000,
  "after-day-end": 200,
  "meal-outside-window": 200,
  softHours: 30,
} as const;

export const DEFAULT_DURATION: Record<PlaceKind, number> = {
  food: 60,
  attraction: 90,
  cafe: 45,
  shopping: 75,
  lodging: 30,
  transport: 30,
  other: 60,
};

export function defaultDayConstraints(): DayConstraints {
  return {
    dayStart: "09:00",
    dayEnd: "21:30",
    lunchWindow: ["11:30", "14:00"],
    dinnerWindow: ["17:30", "20:30"],
  };
}

export function durationMinForKind(kind: PlaceKind, override?: number): number {
  if (typeof override === "number" && override > 0) return override;
  return DEFAULT_DURATION[kind] ?? 60;
}

function toMin(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function fromMin(total: number): string {
  const t = Math.max(0, Math.round(total));
  const h = Math.floor(t / 60) % 24;
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function inWindow(t: number, window: [string, string]): boolean {
  return t >= toMin(window[0]) && t <= toMin(window[1]);
}

export function evaluateOrder(
  order: number[],
  stops: SolverStop[],
  durationsSec: number[][],
  c: DayConstraints
): { cost: number; timetable: TimetableEntry[]; violations: number } {
  const timetable: TimetableEntry[] = [];
  let clock = toMin(c.dayStart);
  let totalViolations = 0;
  let cost = 0;
  let prevIdx: number | null = null;

  for (let k = 0; k < order.length; k++) {
    const idx = order[k]!;
    const stop = stops[idx]!;
    let travelMin = 0;
    if (prevIdx != null) {
      travelMin = Math.round((durationsSec[prevIdx]?.[idx] ?? 0) / 60);
    } else if (c.start) {
      travelMin = Math.round(
        estimateLeg(
          ANCHOR_TRAVEL_MODE,
          c.start.lat,
          c.start.lng,
          stop.lat,
          stop.lng
        ).durationSec / 60
      );
    }
    if (travelMin > 0) {
      clock += travelMin;
      cost += travelMin;
    }

    const hoursUnknown =
      stop.hoursKnown === false ||
      !stop.opening?.length;
    const violations: Violation[] = [];
    let waitMin = 0;

    if (stop.fixed?.at) {
      const fixedAt = toMin(stop.fixed.at);
      if (clock > fixedAt + 5) {
        violations.push("fixed-missed");
      } else if (clock < fixedAt) {
        waitMin = fixedAt - clock;
        clock = fixedAt;
      }
    }

    if (!hoursUnknown && stop.opening) {
      const open = toMin(stop.opening[0]!.open);
      const close = toMin(stop.opening[0]!.close);
      if (clock < open) {
        waitMin += open - clock;
        clock = open;
      }
      if (clock >= close) {
        violations.push("closed");
      }
    } else {
      const def = DEFAULT_HOURS[stop.kind];
      if (clock < toMin(def.open) || clock > toMin(def.close)) {
        cost += PENALTY.softHours;
      }
    }

    if (stop.kind === "food") {
      const inLunch = inWindow(clock, c.lunchWindow);
      const inDinner = inWindow(clock, c.dinnerWindow);
      if (!inLunch && !inDinner) {
        violations.push("meal-outside-window");
      }
    }

    const arrive = clock;
    const duration = stop.durationMin || DEFAULT_DURATION[stop.kind];
    clock += duration;
    if (clock > toMin(c.dayEnd)) {
      violations.push("after-day-end");
    }

    cost += waitMin * 0.5;
    for (const v of violations) {
      cost += PENALTY[v];
      totalViolations += 1;
    }

    timetable.push({
      stopId: stop.id,
      arrive: fromMin(arrive),
      depart: fromMin(clock),
      travelFromPrevMin: travelMin,
      waitMin,
      hoursUnknown,
      violations,
    });
    prevIdx = idx;
  }

  if (prevIdx != null && c.end) {
    const last = stops[prevIdx]!;
    const returnMin = Math.round(
      estimateLeg(
        ANCHOR_TRAVEL_MODE,
        last.lat,
        last.lng,
        c.end.lat,
        c.end.lng
      ).durationSec / 60
    );
    cost += returnMin;
  }

  return { cost, timetable, violations: totalViolations };
}

export function solveDay(
  stops: SolverStop[],
  durationsSec: number[][],
  c: DayConstraints,
  opts?: { seed?: number }
): DayPlan {
  const constraints = { ...defaultDayConstraints(), ...c };
  const n = stops.length;
  if (n === 0) {
    return {
      order: [],
      timetable: [],
      totalTravelMin: 0,
      totalViolations: 0,
      usedFallback: false,
    };
  }

  const costFn = (order: number[]) =>
    evaluateOrder(order, stops, durationsSec, constraints).cost;

  let bestOrder: number[];
  if (n <= 8) {
    const indices = Array.from({ length: n }, (_, i) => i);
    let best = [...indices];
    let bestCost = Infinity;
    const permute = (start: number) => {
      if (start === n) {
        const cost = costFn(indices);
        if (cost < bestCost) {
          bestCost = cost;
          best = [...indices];
        }
        return;
      }
      for (let i = start; i < n; i++) {
        [indices[start], indices[i]] = [indices[i]!, indices[start]!];
        permute(start + 1);
        [indices[start], indices[i]] = [indices[i]!, indices[start]!];
      }
    };
    permute(0);
    bestOrder = best;
  } else {
    const result = optimizeRouteGenetic(n, durationsSec, {
      seed: opts?.seed ?? 42,
      costFn,
      generations: 80,
    });
    bestOrder = result.order;
  }

  const evaluated = evaluateOrder(
    bestOrder,
    stops,
    durationsSec,
    constraints
  );
  return {
    order: bestOrder.map((i) => stops[i]!.id),
    timetable: evaluated.timetable,
    totalTravelMin: evaluated.timetable.reduce(
      (s, e) => s + e.travelFromPrevMin,
      0
    ),
    totalViolations: evaluated.violations,
    usedFallback: evaluated.violations > 0,
  };
}
