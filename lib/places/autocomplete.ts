import { z } from "zod";
import {
  AIRPORT_OFFICIAL_NAMES,
  AIRPORT_PLACES,
  getPopularCities,
  searchAirportPlaces,
  searchCityPlaces,
  type AirportPlace,
} from "@/lib/airports/data";

export type PlaceType = "country" | "city" | "airport";

export type PlaceItem = {
  id: string;
  type: PlaceType;
  code: string;
  name: string;
  cityName?: string;
  cityCode?: string;
  countryName?: string;
  countryCode?: string;
  matchedCode?: string;
};

export type PlaceAutocompleteMode = "all" | "cities";
export type PlaceAutocompleteSource = "remote" | "local";

const upstreamPlaceSchema = z.object({
  type: z.enum(["country", "city", "airport"]),
  code: z.string().min(1),
  name: z.string().min(1),
  country_code: z.string().optional().nullable(),
  country_name: z.string().optional().nullable(),
  city_code: z.string().optional().nullable(),
  city_name: z.string().optional().nullable(),
  weight: z.number().optional().nullable(),
});

export const upstreamPlacesSchema = z.array(upstreamPlaceSchema);

export type UpstreamPlace = z.infer<typeof upstreamPlaceSchema>;

const CITY_SUFFIX_RE = /(특별시|광역시|특별자치시|특별자치도)$/u;

export function stripCitySuffix(name: string): string {
  return name.replace(CITY_SUFFIX_RE, "").trim();
}

function airportDisplayName(code: string, fallback: string): string {
  return AIRPORT_OFFICIAL_NAMES[code.toUpperCase()] ?? fallback;
}

function localCityCode(place: AirportPlace): string {
  if (place.code) return place.code.toUpperCase();
  const m = /^city-(.+)$/i.exec(place.id);
  return (m?.[1] ?? place.id).toUpperCase();
}

/** AirportPlace → PlaceItem (로컬 폴백용) */
export function toPlaceItem(place: AirportPlace): PlaceItem {
  if (place.kind === "city") {
    const code = localCityCode(place);
    const item: PlaceItem = {
      id: `city:${code}`,
      type: "city",
      code,
      name: place.city || place.name,
      countryName: place.country || undefined,
    };
    if (place.matchedCode) item.matchedCode = place.matchedCode;
    return item;
  }

  const code = (place.code ?? "").toUpperCase();
  return {
    id: `airport:${code || place.id}`,
    type: "airport",
    code: code || place.id,
    name: airportDisplayName(code, place.name),
    cityName: place.city || undefined,
    countryName: place.country || undefined,
  };
}

export function formatPlaceDestination(place: PlaceItem): string {
  if (place.type === "country") return place.name;
  if (place.countryName) return `${place.name}, ${place.countryName}`;
  return place.name;
}

export function formatPlaceFlightLabel(place: PlaceItem): string {
  if (place.type === "airport") {
    return `${airportDisplayName(place.code, place.name)}(${place.code})`;
  }
  if (place.type === "city") {
    if (place.code) return `${place.name}(${place.code})`;
    return `${place.name}(전체)`;
  }
  return place.name;
}

export function formatPlaceListTitle(
  place: PlaceItem,
  placesMode: PlaceAutocompleteMode
): string {
  if (place.type === "country") return `${place.name} 전체`;
  if (placesMode === "cities") return place.name;
  if (place.type === "airport") {
    return airportDisplayName(place.code, place.name);
  }
  return place.name;
}

export function formatPlaceListSubtitle(place: PlaceItem): string {
  if (place.type === "country") return "나라 전체";
  if (place.type === "city") {
    const base = place.countryName ?? "";
    if (place.matchedCode) {
      return base
        ? `${base} · ${place.matchedCode}로 찾음`
        : `${place.matchedCode}로 찾음`;
    }
    return base;
  }
  const parts = [place.cityName, place.countryName].filter(Boolean);
  return parts.join(" · ");
}

function isExactCodeQuery(query: string): boolean {
  return /^[A-Za-z]{3}$/.test(query.trim());
}

/**
 * Travelpayouts places2 JSON → PlaceItem[].
 * cities 모드: 공항은 부모 도시로 올리고 matchedCode 부여, 도시 id 중복 제거.
 */
export function normalizeUpstreamPlaces(
  raw: unknown,
  query: string,
  mode: PlaceAutocompleteMode,
  limit = 10
): PlaceItem[] {
  const parsed = upstreamPlacesSchema.safeParse(raw);
  if (!parsed.success) return [];

  const exact = isExactCodeQuery(query);
  const qUpper = query.trim().toUpperCase();

  type Ranked = { item: PlaceItem; exact: boolean; ord: number };
  const ranked: Ranked[] = [];
  const seenCity = new Set<string>();

  parsed.data.forEach((row, ord) => {
    const code = row.code.toUpperCase();

    if (mode === "cities" && row.type === "airport") {
      const cityCode = (row.city_code ?? "").toUpperCase();
      if (!cityCode) return;
      const cityId = `city:${cityCode}`;
      if (seenCity.has(cityId)) return;
      seenCity.add(cityId);
      const cityName = stripCitySuffix(row.city_name ?? row.name);
      ranked.push({
        ord,
        exact: exact && (code === qUpper || cityCode === qUpper),
        item: {
          id: cityId,
          type: "city",
          code: cityCode,
          name: cityName,
          cityCode,
          countryName: row.country_name ?? undefined,
          countryCode: row.country_code ?? undefined,
          matchedCode: code,
        },
      });
      return;
    }

    if (row.type === "city") {
      const cityId = `city:${code}`;
      if (mode === "cities") {
        if (seenCity.has(cityId)) return;
        seenCity.add(cityId);
      }
      ranked.push({
        ord,
        exact: exact && code === qUpper,
        item: {
          id: cityId,
          type: "city",
          code,
          name: stripCitySuffix(row.name),
          cityCode: code,
          countryName: row.country_name ?? undefined,
          countryCode: row.country_code ?? undefined,
        },
      });
      return;
    }

    if (row.type === "country") {
      ranked.push({
        ord,
        exact: exact && code === qUpper,
        item: {
          id: `country:${code}`,
          type: "country",
          code,
          name: row.name,
          countryName: row.name,
          countryCode: code,
        },
      });
      return;
    }

    if (mode === "cities") return;

    ranked.push({
      ord,
      exact: exact && code === qUpper,
      item: {
        id: `airport:${code}`,
        type: "airport",
        code,
        name: airportDisplayName(code, row.name),
        cityName: row.city_name ? stripCitySuffix(row.city_name) : undefined,
        cityCode: row.city_code?.toUpperCase() || undefined,
        countryName: row.country_name ?? undefined,
        countryCode: row.country_code ?? undefined,
      },
    });
  });

  // 3글자 코드 정확일치만 최상단으로. 나머지는 업스트림 순서(대체로 weight↓) 유지.
  ranked.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    return a.ord - b.ord;
  });

  return ranked.slice(0, Math.max(0, limit)).map((r) => r.item);
}

export function searchLocalPlaceItems(
  query: string,
  mode: PlaceAutocompleteMode,
  limit = 10
): PlaceItem[] {
  const q = query.trim();
  if (!q) {
    return getPopularCities(limit).map(toPlaceItem);
  }

  if (mode === "cities") {
    return searchCityPlaces(q, limit).map(toPlaceItem);
  }

  return searchAirportPlaces(q, limit).map(toPlaceItem);
}

/** 테스트·디버그용: 로컬 데이터에 공항 코드가 있는지 */
export function hasLocalAirportCode(code: string): boolean {
  const upper = code.toUpperCase();
  return AIRPORT_PLACES.some((p) => p.code?.toUpperCase() === upper);
}
