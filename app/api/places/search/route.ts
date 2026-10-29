import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/places/index";
import type { PlaceKind, PlaceSearchParams } from "@/lib/places/types";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 30;

const KINDS = new Set<PlaceKind>([
  "attraction",
  "food",
  "cafe",
  "shopping",
  "lodging",
  "transport",
  "other",
]);

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "places" });
  if (guard instanceof NextResponse) return guard;

  try {
    const body = (await request.json()) as Partial<PlaceSearchParams>;
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!city || query.length < 2 || query.length > 60) {
      return NextResponse.json({ error: "invalid-payload" }, { status: 400 });
    }

    let maxResults = 20;
    if (typeof body.maxResults === "number" && Number.isFinite(body.maxResults)) {
      maxResults = Math.min(45, Math.max(1, Math.floor(body.maxResults)));
    }

    const kind =
      typeof body.kind === "string" && KINDS.has(body.kind as PlaceKind)
        ? (body.kind as PlaceKind)
        : undefined;

    const params: PlaceSearchParams = {
      city,
      query,
      maxResults,
    };
    if (typeof body.country === "string" && body.country.trim()) {
      params.country = body.country.trim();
    }
    if (kind) params.kind = kind;
    if (
      body.center &&
      typeof body.center.lat === "number" &&
      typeof body.center.lng === "number"
    ) {
      params.center = { lat: body.center.lat, lng: body.center.lng };
    }
    if (
      typeof body.radiusMeters === "number" &&
      Number.isFinite(body.radiusMeters)
    ) {
      params.radiusMeters = body.radiusMeters;
    }
    if (typeof body.languageCode === "string" && body.languageCode.trim()) {
      params.languageCode = body.languageCode.trim();
    }

    const result = await searchPlaces(params);
    return NextResponse.json(result);
  } catch (error) {
    console.warn(
      "[api/places/search]",
      error instanceof Error ? error.message : "unknown"
    );
    return NextResponse.json(
      {
        places: [],
        source: "empty",
        provider: null,
        capabilities: {
          rating: false,
          openingHours: false,
          priceLevel: false,
        },
      },
      { status: 200 }
    );
  }
}
