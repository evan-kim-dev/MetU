import type { LatLng } from "@/lib/route/types";

type GeocodeCache = Map<string, LatLng | null>;
type InflightMap = Map<string, Promise<LatLng | null>>;

function cacheKey(query: string): string {
  return query.trim().toLowerCase();
}

async function geocodePhoton(
  query: string,
  lang: "en" | "ko" = "en"
): Promise<LatLng | null> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", lang);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    features?: {
      geometry?: { coordinates?: [number, number] };
    }[];
  };
  const coords = json.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function geocodeOpenMeteo(query: string): Promise<LatLng | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=1&language=ko&format=json`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: { latitude: number; longitude: number }[];
  };
  const hit = json.results?.[0];
  if (!hit) return null;
  return { lat: hit.latitude, lng: hit.longitude };
}

async function resolveQuery(
  query: string,
  cache: GeocodeCache,
  inflight: InflightMap,
  preferKo = false
): Promise<LatLng | null> {
  const key = `${preferKo ? "ko:" : "en:"}${cacheKey(query)}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    let point = preferKo
      ? await geocodePhoton(query, "ko")
      : await geocodePhoton(query, "en");
    if (!point && preferKo) point = await geocodePhoton(query, "en");
    if (!point && !preferKo) point = await geocodePhoton(query, "ko");
    if (!point) point = await geocodeOpenMeteo(query);
    cache.set(key, point);
    inflight.delete(key);
    return point;
  })();

  inflight.set(key, task);
  return task;
}

function isDomesticContext(destination: string, country: string): boolean {
  const text = `${destination} ${country}`.toLowerCase();
  return /한국|대한민국|korea|국내|서울|부산|제주|강릉|전주|인천|대구|광주|대전|울산|여수|속초|경주/.test(
    text
  );
}

/**
 * Geocode a place query with destination context.
 * Photon (OSM) first for POIs, Open-Meteo as city-level fallback.
 */
export async function geocodePlaceQuery(
  title: string,
  destination: string,
  country: string,
  cache: GeocodeCache,
  inflight: InflightMap = new Map()
): Promise<LatLng | null> {
  const cleaned = title
    .replace(/^[0-9]{1,2}:[0-9]{2}\s*/, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s*[·•|/→]\s*/g, " ")
    .replace(
      /투어|탐방|방문|산책|자유\s*시간|추천|근처|주변|저녁\s*식사|점심|브런치|간식|이동$|도착$|출국$|또는.+$/gi,
      " "
    )
    .replace(/무료|유료|원\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2) return null;

  const domestic = isDomesticContext(destination, country);
  const countryHint = domestic
    ? country?.trim() || "대한민국"
    : country?.trim() || "";

  // 영어 POI명 우선 추출 (Gardens by the Bay 등)
  const latin = cleaned.match(/[A-Za-z][A-Za-z0-9 .'\-]{2,}/)?.[0]?.trim();
  const queries = [
    latin ? [latin, destination, countryHint].filter(Boolean).join(", ") : null,
    latin ? [latin, destination].filter(Boolean).join(", ") : null,
    latin,
    [cleaned, destination, countryHint].filter(Boolean).join(", "),
    [cleaned, destination].filter(Boolean).join(", "),
    cleaned,
  ].filter((q): q is string => Boolean(q && q.length >= 2));

  for (const query of queries) {
    const point = await resolveQuery(query, cache, inflight, domestic);
    if (point) return point;
  }

  return null;
}

export function createGeocodeCache(): GeocodeCache {
  return new Map();
}

export function createGeocodeInflight(): InflightMap {
  return new Map();
}

/** Titles that should stay fixed in the day's sequence. */
export function isFixedScheduleTitle(title: string): boolean {
  const t = title.toLowerCase();
  return /체크인|체크아웃|check[\s-]?in|check[\s-]?out|공항|항공|비행|airport|ktx|기차|터미널|출국|입국|이동\s*시간|호텔\s*도착|숙소\s*도착|짐\s*맡|조식\s*호텔/.test(
    t
  );
}
