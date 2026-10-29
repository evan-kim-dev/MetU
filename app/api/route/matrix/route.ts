import { NextResponse } from "next/server";
import {
  getTravelMatrix,
  refineLegsForOrder,
  type MatrixPoint,
  type TravelMode,
} from "@/lib/route/travel-matrix";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const MODES = new Set<TravelMode>(["WALK", "TRANSIT", "DRIVE"]);

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "places" });
  if (guard instanceof NextResponse) return guard;

  try {
    const body = (await request.json()) as {
      points?: MatrixPoint[];
      mode?: TravelMode;
      region?: "KR" | "GLOBAL";
      order?: number[];
    };

    const points = body.points;
    if (!Array.isArray(points) || points.length < 2 || points.length > 25) {
      return NextResponse.json({ error: "invalid-payload" }, { status: 400 });
    }
    for (const p of points) {
      if (
        !p?.id ||
        typeof p.lat !== "number" ||
        typeof p.lng !== "number" ||
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lng)
      ) {
        return NextResponse.json({ error: "invalid-payload" }, { status: 400 });
      }
    }

    const mode =
      typeof body.mode === "string" && MODES.has(body.mode)
        ? body.mode
        : "WALK";
    const region = body.region === "KR" ? "KR" : "GLOBAL";

    let matrix = await getTravelMatrix(points, mode, { region });
    if (
      Array.isArray(body.order) &&
      body.order.length >= 2 &&
      region === "KR"
    ) {
      matrix = await refineLegsForOrder(matrix, points, body.order);
    }

    return NextResponse.json(matrix);
  } catch (error) {
    console.warn(
      "[api/route/matrix]",
      error instanceof Error ? error.message : "unknown"
    );
    return NextResponse.json({ error: "matrix-failed" }, { status: 500 });
  }
}
