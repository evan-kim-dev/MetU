import "server-only";

import { TABLES } from "@/lib/constants";
import type {
  OpeningPeriod,
  Place,
  PlaceKind,
  PlaceProviderId,
} from "@/lib/places/types";
import { getServiceSupabase } from "@/lib/supabase/admin";

/**
 * 공급자별 TTL (일).
 * 약관 확인 전 보수적 가정 — Google Service Specific Terms,
 * Kakao 이용약관/운영정책의 저장 허용 범위를 직접 확인할 것.
 */
export const PLACES_CACHE_TTL_DAYS = {
  google: 30,
  kakao: 7,
} as const;

const CACHE_HIT_MIN_ROWS = 15;
const MEMORY_MAX = 100;
const MEMORY_TTL_MS = 10 * 60 * 1000;

type MemoryEntry = { places: Place[]; expiresAt: number };
const memoryLru = new Map<string, MemoryEntry>();

function memoryKey(parts: {
  provider: PlaceProviderId;
  city: string;
  kind?: PlaceKind;
  limit: number;
}): string {
  return `${parts.provider}|${parts.city}|${parts.kind ?? "*"}|${parts.limit}`;
}

function touchMemory(key: string, places: Place[]): void {
  if (memoryLru.has(key)) memoryLru.delete(key);
  memoryLru.set(key, {
    places,
    expiresAt: Date.now() + MEMORY_TTL_MS,
  });
  while (memoryLru.size > MEMORY_MAX) {
    const oldest = memoryLru.keys().next().value;
    if (oldest === undefined) break;
    memoryLru.delete(oldest);
  }
}

function readMemory(key: string): Place[] | null {
  const entry = memoryLru.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryLru.delete(key);
    return null;
  }
  // LRU touch
  memoryLru.delete(key);
  memoryLru.set(key, entry);
  return entry.places;
}

type PlaceRow = {
  id: string;
  provider: PlaceProviderId;
  provider_place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  kind: PlaceKind;
  types: string[] | null;
  rating: number | null;
  user_rating_count: number | null;
  price_level: string | null;
  opening_hours: OpeningPeriod[] | null;
  utc_offset_minutes: number | null;
  maps_uri: string | null;
  phone: string | null;
  category_name: string | null;
  city: string;
  country_code: string | null;
  fetched_at: string;
};

function rowToPlace(row: PlaceRow): Place {
  const place: Place = {
    id: row.id,
    provider: row.provider,
    providerPlaceId: row.provider_place_id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    kind: row.kind,
    types: row.types ?? [],
    city: row.city,
    fetchedAt: row.fetched_at,
  };
  if (row.address) place.address = row.address;
  if (row.rating != null) place.rating = Number(row.rating);
  if (row.user_rating_count != null) {
    place.userRatingCount = row.user_rating_count;
  }
  if (row.price_level) place.priceLevel = row.price_level;
  if (row.opening_hours) place.openingHours = row.opening_hours;
  if (row.utc_offset_minutes != null) {
    place.utcOffsetMinutes = row.utc_offset_minutes;
  }
  if (row.maps_uri) place.mapsUri = row.maps_uri;
  if (row.phone) place.phone = row.phone;
  if (row.category_name) place.categoryName = row.category_name;
  if (row.country_code) place.countryCode = row.country_code;
  return place;
}

function placeToRow(place: Place) {
  return {
    provider: place.provider,
    provider_place_id: place.providerPlaceId,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    address: place.address ?? null,
    kind: place.kind,
    types: place.types,
    rating: place.rating ?? null,
    user_rating_count: place.userRatingCount ?? null,
    price_level: place.priceLevel ?? null,
    opening_hours: place.openingHours ?? null,
    utc_offset_minutes: place.utcOffsetMinutes ?? null,
    maps_uri: place.mapsUri ?? null,
    phone: place.phone ?? null,
    category_name: place.categoryName ?? null,
    city: place.city,
    country_code: place.countryCode ?? null,
    fetched_at: place.fetchedAt || new Date().toISOString(),
  };
}

export function isCacheFresh(
  fetchedAt: string,
  provider: PlaceProviderId
): boolean {
  const ttlDays = PLACES_CACHE_TTL_DAYS[provider];
  const fetched = Date.parse(fetchedAt);
  if (!Number.isFinite(fetched)) return false;
  const ageMs = Date.now() - fetched;
  return ageMs <= ttlDays * 24 * 60 * 60 * 1000;
}

export async function getCachedPlaces(params: {
  provider: PlaceProviderId;
  city: string;
  kind?: PlaceKind;
  limit?: number;
}): Promise<Place[]> {
  const limit = params.limit ?? CACHE_HIT_MIN_ROWS;
  const key = memoryKey({ ...params, limit });
  const mem = readMemory(key);
  if (mem) return mem;

  const supabase = getServiceSupabase();
  if (!supabase) return [];

  let query = supabase
    .from(TABLES.places)
    .select("*")
    .eq("provider", params.provider)
    .eq("city", params.city)
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (params.kind) {
    query = query.eq("kind", params.kind);
  }

  const { data, error } = await query;
  if (error || !data?.length) {
    if (error) {
      console.warn("[places/cache] getCachedPlaces:", error.message);
    }
    return [];
  }

  const places = (data as PlaceRow[])
    .filter((row) => isCacheFresh(row.fetched_at, params.provider))
    .map(rowToPlace);

  if (places.length) touchMemory(key, places);
  return places;
}

/** 같은 (provider, city, kind) 에 TTL 내 행이 N개 이상이면 캐시 히트 */
export async function hasFreshCache(params: {
  provider: PlaceProviderId;
  city: string;
  kind?: PlaceKind;
  minCount?: number;
}): Promise<boolean> {
  const minCount = params.minCount ?? CACHE_HIT_MIN_ROWS;
  const cached = await getCachedPlaces({
    provider: params.provider,
    city: params.city,
    kind: params.kind,
    limit: minCount,
  });
  return cached.length >= minCount;
}

export async function upsertPlaces(places: Place[]): Promise<Place[]> {
  if (!places.length) return [];
  const supabase = getServiceSupabase();
  if (!supabase) {
    return places;
  }

  const rows = places.map(placeToRow);
  const { data, error } = await supabase
    .from(TABLES.places)
    .upsert(rows, { onConflict: "provider,provider_place_id" })
    .select("*");

  if (error) {
    console.warn("[places/cache] upsertPlaces:", error.message);
    return places;
  }

  const mapped = ((data as PlaceRow[]) ?? []).map(rowToPlace);
  return mapped.length ? mapped : places;
}

export async function getPlacesByIds(ids: string[]): Promise<Place[]> {
  if (!ids.length) return [];
  const supabase = getServiceSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLES.places)
    .select("*")
    .in("id", ids);

  if (error) {
    console.warn("[places/cache] getPlacesByIds:", error.message);
    return [];
  }
  return ((data as PlaceRow[]) ?? []).map(rowToPlace);
}
