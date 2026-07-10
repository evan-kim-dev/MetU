import { NextResponse } from "next/server";
import { resolveTripTipsWithAi } from "@/lib/ai/trip-tips";
import type { Trip } from "@/lib/trips/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { trip?: Trip | null };
    const { tips, source } = await resolveTripTipsWithAi(body.trip ?? null);
    return NextResponse.json({ tips, source });
  } catch {
    return NextResponse.json({ error: "trip-tips-failed" }, { status: 500 });
  }
}
