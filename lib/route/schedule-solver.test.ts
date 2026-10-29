import { describe, expect, it } from "vitest";
import {
  evaluateOrder,
  solveDay,
  type DayConstraints,
  type SolverStop,
} from "@/lib/route/schedule-solver";
import { optimizeRouteGenetic } from "@/lib/route/genetic";
import { buildDistanceMatrix } from "@/lib/route/distance";

const baseConstraints: DayConstraints = {
  dayStart: "09:00",
  dayEnd: "21:30",
  lunchWindow: ["11:30", "14:00"],
  dinnerWindow: ["17:30", "20:30"],
};

describe("schedule-solver", () => {
  it("does not mark hoursUnknown stops as closed", () => {
    const stops: SolverStop[] = [
      {
        id: "a",
        lat: 37.5,
        lng: 127,
        kind: "attraction",
        durationMin: 60,
        hoursKnown: false,
      },
    ];
    const matrix = [[0]];
    const { timetable } = evaluateOrder([0], stops, matrix, baseConstraints);
    expect(timetable[0]!.hoursUnknown).toBe(true);
    expect(timetable[0]!.violations).not.toContain("closed");
  });

  it("prefers lunch restaurant after morning attraction", () => {
    const stops: SolverStop[] = [
      {
        id: "food",
        lat: 37.5,
        lng: 127.01,
        kind: "food",
        durationMin: 60,
        hoursKnown: true,
        opening: [{ open: "12:00", close: "15:00" }],
      },
      {
        id: "sight",
        lat: 37.51,
        lng: 127.0,
        kind: "attraction",
        durationMin: 90,
        hoursKnown: true,
        opening: [{ open: "09:00", close: "18:00" }],
      },
    ];
    const durations = [
      [0, 600],
      [600, 0],
    ];
    const plan = solveDay(stops, durations, baseConstraints, { seed: 1 });
    expect(plan.order[0]).toBe("sight");
    expect(plan.order[1]).toBe("food");
    expect(plan.totalViolations).toBe(0);
  });

  it("keeps genetic pathLengthKm behavior without costFn", () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 0, lng: 2 },
      { lat: 0, lng: 3 },
    ];
    const matrix = buildDistanceMatrix(points);
    const a = optimizeRouteGenetic(4, matrix, { seed: 7 });
    const b = optimizeRouteGenetic(4, matrix, { seed: 7 });
    expect(a.order).toEqual(b.order);
    expect(a.lengthKm).toBe(b.lengthKm);
  });
});
