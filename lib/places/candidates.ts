import "server-only";

import type { TravelStyle } from "@/lib/onboarding/types";
import { regionOf } from "@/lib/geo/region";
import { searchPlaces } from "@/lib/places/index";
import { getPlaceProvider } from "@/lib/places/registry";
import type {
  Place,
  PlaceKind,
  PlaceProviderCapabilities,
  PlaceProviderId,
} from "@/lib/places/types";

const RATING_MIN = 4.0;
const RATING_COUNT_MIN = 100;
const RATING_MIN_RELAXED = 3.5;
const RATING_COUNT_MIN_RELAXED = 50;
const MAX_QUERIES = 6;
const MAX_POOL = 60;

type QuerySpec = { query: string; kind?: PlaceKind };

const STYLE_QUERIES: Partial<Record<TravelStyle, QuerySpec[]>> = {
  food: [
    { query: "맛집", kind: "food" },
    { query: "현지 인기 식당", kind: "food" },
  ],
  healing: [{ query: "카페", kind: "cafe" }],
  hotplace: [{ query: "카페", kind: "cafe" }],
  sightseeing: [{ query: "대표 관광지", kind: "attraction" }],
  culture: [
    { query: "박물관", kind: "attraction" },
    { query: "미술관", kind: "attraction" },
    { query: "역사 유적", kind: "attraction" },
  ],
  nature: [
    { query: "공원", kind: "attraction" },
    { query: "자연 명소", kind: "attraction" },
  ],
  shopping: [
    { query: "쇼핑 거리", kind: "shopping" },
    { query: "쇼핑몰", kind: "shopping" },
  ],
  "shopping-mall": [{ query: "쇼핑몰", kind: "shopping" }],
  activity: [{ query: "액티비티 체험", kind: "attraction" }],
};

function buildQueries(styles: TravelStyle[]): QuerySpec[] {
  const seen = new Set<string>();
  const out: QuerySpec[] = [];

  const push = (spec: QuerySpec) => {
    const key = `${spec.kind ?? ""}:${spec.query}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(spec);
  };

  // 항상 포함
  push({ query: "대표 관광지", kind: "attraction" });
  push({ query: "맛집", kind: "food" });

  for (const style of styles) {
    for (const spec of STYLE_QUERIES[style] ?? []) {
      push(spec);
      if (out.length >= MAX_QUERIES) return out;
    }
  }
  return out.slice(0, MAX_QUERIES);
}

function dedupeKey(p: Place): string {
  return `${p.provider}:${p.providerPlaceId}`;
}

function nameAddressKey(p: Place): string {
  return `${p.name.trim().toLowerCase()}|${(p.address ?? "").trim().toLowerCase()}`;
}

function filterByRating(
  places: Place[],
  minRating: number,
  minCount: number
): Place[] {
  return places.filter(
    (p) =>
      typeof p.rating === "number" &&
      p.rating >= minRating &&
      typeof p.userRatingCount === "number" &&
      p.userRatingCount >= minCount
  );
}

function filterKakao(places: Place[]): Place[] {
  const seenName = new Set<string>();
  const out: Place[] = [];
  for (const p of places) {
    if (p.kind === "other") continue;
    const key = nameAddressKey(p);
    if (seenName.has(key)) continue;
    seenName.add(key);
    out.push(p);
  }
  return out;
}

export async function buildCandidatePool(input: {
  city: string;
  country?: string;
  styles: TravelStyle[];
  nights: number;
}): Promise<{
  places: Place[];
  source: "places" | "empty";
  provider: PlaceProviderId | null;
  capabilities: PlaceProviderCapabilities;
}> {
  const region = regionOf({
    country: input.country,
    destination: input.city,
  });
  const provider = getPlaceProvider(region);
  const emptyCaps: PlaceProviderCapabilities = {
    rating: false,
    openingHours: false,
    priceLevel: false,
  };

  if (!provider.isConfigured()) {
    return {
      places: [],
      source: "empty",
      provider: null,
      capabilities: emptyCaps,
    };
  }

  const queries = buildQueries(input.styles);
  const settled = await Promise.allSettled(
    queries.map((q) =>
      searchPlaces({
        city: input.city,
        country: input.country,
        query: q.query,
        kind: q.kind,
        maxResults: provider.id === "google" ? 20 : 30,
      })
    )
  );

  const byId = new Map<string, Place>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const place of result.value.places) {
      byId.set(dedupeKey(place), place);
    }
  }

  let places = Array.from(byId.values());

  if (provider.capabilities.rating) {
    let filtered = filterByRating(places, RATING_MIN, RATING_COUNT_MIN);
    if (filtered.length < 8) {
      filtered = filterByRating(
        places,
        RATING_MIN_RELAXED,
        RATING_COUNT_MIN_RELAXED
      );
    }
    places = filtered.length ? filtered : places;
  } else {
    places = filterKakao(places);
  }

  const poolCap = Math.min(MAX_POOL, Math.max(16, (input.nights + 1) * 8));
  places = places.slice(0, poolCap);

  return {
    places,
    source: places.length ? "places" : "empty",
    provider: provider.id,
    capabilities: provider.capabilities,
  };
}
