import "server-only";

import { regionOf } from "@/lib/geo/region";
import {
  getCachedPlaces,
  hasFreshCache,
  upsertPlaces,
} from "@/lib/places/cache";
import { getPlaceProvider } from "@/lib/places/registry";
import type {
  PlaceSearchParams,
  PlaceSearchResult,
} from "@/lib/places/types";

const EMPTY_CAPABILITIES = {
  rating: false,
  openingHours: false,
  priceLevel: false,
};

export async function searchPlaces(
  params: PlaceSearchParams
): Promise<PlaceSearchResult> {
  const region = regionOf({
    country: params.country,
    destination: params.city,
    lat: params.center?.lat,
    lng: params.center?.lng,
  });
  const provider = getPlaceProvider(region);

  if (!provider.isConfigured()) {
    return {
      places: [],
      source: "empty",
      provider: null,
      capabilities: EMPTY_CAPABILITIES,
    };
  }

  const cacheHit = await hasFreshCache({
    provider: provider.id,
    city: params.city,
    kind: params.kind,
  });

  if (cacheHit) {
    const cached = await getCachedPlaces({
      provider: provider.id,
      city: params.city,
      kind: params.kind,
      limit: params.maxResults ?? 30,
    });
    if (cached.length) {
      return {
        places: cached,
        source: "cache",
        provider: provider.id,
        capabilities: provider.capabilities,
      };
    }
  }

  const places = await provider.search(params);
  if (!places.length) {
    return {
      places: [],
      source: "empty",
      provider: provider.id,
      capabilities: provider.capabilities,
    };
  }

  const stored = await upsertPlaces(places);
  return {
    places: stored,
    source: provider.id,
    provider: provider.id,
    capabilities: provider.capabilities,
  };
}

export type { Place, PlaceSearchParams, PlaceSearchResult } from "@/lib/places/types";
export { regionOf } from "@/lib/geo/region";
export { getPlaceProvider } from "@/lib/places/registry";
