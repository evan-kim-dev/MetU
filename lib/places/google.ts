import "server-only";

import { mapGooglePlace, type GooglePlaceRaw } from "@/lib/places/google-map";
import type {
  Place,
  PlaceProvider,
  PlaceProviderCapabilities,
  PlaceSearchParams,
} from "@/lib/places/types";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.rating,places.userRatingCount,places.priceLevel,places.regularOpeningHours,places.utcOffsetMinutes,places.googleMapsUri,places.businessStatus";
const CENTER_FIELD_MASK = "places.location";
const TIMEOUT_MS = 8000;

const CAPABILITIES: PlaceProviderCapabilities = {
  rating: true,
  openingHours: true,
  priceLevel: true,
};

function apiKey(): string | undefined {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  return key || undefined;
}

async function searchText(opts: {
  textQuery: string;
  languageCode: string;
  maxResultCount: number;
  fieldMask: string;
  center?: { lat: number; lng: number };
  radiusMeters?: number;
}): Promise<GooglePlaceRaw[]> {
  const key = apiKey();
  if (!key) return [];

  const body: Record<string, unknown> = {
    textQuery: opts.textQuery,
    languageCode: opts.languageCode,
    maxResultCount: opts.maxResultCount,
  };
  if (opts.center) {
    body.locationBias = {
      circle: {
        center: {
          latitude: opts.center.lat,
          longitude: opts.center.lng,
        },
        radius: opts.radiusMeters ?? 15000,
      },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": opts.fieldMask,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(
        `[places/google] searchText HTTP ${res.status} (key redacted)`
      );
      return [];
    }
    const json = (await res.json()) as { places?: GooglePlaceRaw[] };
    return Array.isArray(json.places) ? json.places : [];
  } catch (error) {
    console.warn(
      "[places/google] searchText failed:",
      error instanceof Error ? error.message : "unknown"
    );
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export class GooglePlaceProvider implements PlaceProvider {
  readonly id = "google" as const;
  readonly capabilities = CAPABILITIES;

  isConfigured(): boolean {
    return Boolean(apiKey());
  }

  async resolveCenter(
    city: string,
    country?: string
  ): Promise<{ lat: number; lng: number } | null> {
    if (!this.isConfigured()) return null;
    const textQuery = [city, country].filter(Boolean).join(" ");
    const places = await searchText({
      textQuery,
      languageCode: "ko",
      maxResultCount: 1,
      fieldMask: CENTER_FIELD_MASK,
    });
    const loc = places[0]?.location;
    if (
      typeof loc?.latitude === "number" &&
      typeof loc?.longitude === "number" &&
      Number.isFinite(loc.latitude) &&
      Number.isFinite(loc.longitude)
    ) {
      return { lat: loc.latitude, lng: loc.longitude };
    }
    return null;
  }

  async search(params: PlaceSearchParams): Promise<Place[]> {
    if (!this.isConfigured()) return [];

    const maxResults = Math.min(20, Math.max(1, params.maxResults ?? 20));
    const radius = params.radiusMeters ?? 15000;
    let center = params.center;
    if (!center) {
      center =
        (await this.resolveCenter(params.city, params.country)) ?? undefined;
    }

    const raws = await searchText({
      textQuery: `${params.city} ${params.query}`.trim(),
      languageCode: params.languageCode ?? "ko",
      maxResultCount: maxResults,
      fieldMask: FIELD_MASK,
      center,
      radiusMeters: radius,
    });

    const out: Place[] = [];
    for (const raw of raws) {
      const mapped = mapGooglePlace(raw, params.city);
      if (mapped) out.push(mapped);
    }
    return out;
  }
}

export const googlePlaceProvider = new GooglePlaceProvider();
