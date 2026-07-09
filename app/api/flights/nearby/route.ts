import { NextResponse } from "next/server";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";

type NearbyResponse = {
  airports?: string[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "invalid-coordinates" }, { status: 400 });
  }

  try {
    const res = await backendFetch(`/flights/nearby?lat=${lat}&lng=${lng}`);
    if (!res.ok) {
      return NextResponse.json(
        { airports: ["서울", "인천", "김포"], source: "fallback" },
        { status: 200 }
      );
    }

    const payload = (await res.json()) as NearbyResponse;
    const airports = Array.isArray(payload.airports)
      ? payload.airports.filter(Boolean)
      : [];

    return NextResponse.json({
      airports: airports.length > 0 ? airports : ["서울", "인천", "김포"],
    });
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json({ error: "backend-unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "nearby-failed" }, { status: 500 });
  }
}
