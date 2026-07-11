import { NextResponse } from "next/server";
import type { DaySchedule } from "@/lib/ai/types";
import { optimizeDailyScheduleRoutes } from "@/lib/route/optimize-schedule";

export const maxDuration = 60;

/**
 * Re-optimize an existing daily schedule with a genetic algorithm.
 * Used by recommend UI / trip detail for on-demand re-runs.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      dailySchedule?: DaySchedule[];
      destination?: string;
      country?: string;
    };

    const schedule = body.dailySchedule;
    const destination = body.destination?.trim();
    if (!schedule?.length || !destination) {
      return NextResponse.json({ error: "invalid-payload" }, { status: 400 });
    }

    const { schedule: nextSchedule, meta } = await optimizeDailyScheduleRoutes(
      schedule,
      destination,
      body.country?.trim() || ""
    );

    return NextResponse.json({
      dailySchedule: nextSchedule,
      routeOptimization: {
        applied: meta.applied,
        method: meta.method,
        savedKm: meta.savedKm,
        totalKmBefore: meta.totalKmBefore,
        totalKmAfter: meta.totalKmAfter,
      },
    });
  } catch (error) {
    console.error("[api/route/optimize]", error);
    return NextResponse.json({ error: "optimize-failed" }, { status: 500 });
  }
}
