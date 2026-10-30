import {
  AIRPORT_OFFICIAL_NAMES,
  AIRPORT_PLACES,
  POPULAR_PLACE_IDS,
  formatAirportInputLabel,
  getPopularCities,
  type AirportPlace,
} from "@/lib/airports/data";

export type MatchedOn = "code" | "name" | "keyword" | "country";

export type PlaceResult = {
  place: AirportPlace;
  parent?: AirportPlace;
  children?: AirportPlace[];
  score: number;
  matchedOn: MatchedOn;
  /** cities 모드에서 공항코드로 부모 도시를 올린 경우 */
  matchedCode?: string;
};

export type SearchPlacesMode = "all" | "cities";

/** trim · 소문자 · 공백 제거 · NFC */
export function normalizePlaceQuery(query: string): string {
  return query.normalize("NFC").trim().toLowerCase().replace(/\s+/g, "");
}

function popularIndex(id: string): number {
  const idx = (POPULAR_PLACE_IDS as readonly string[]).indexOf(id);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function placeById(id: string): AirportPlace | undefined {
  return AIRPORT_PLACES.find((p) => p.id === id);
}

function citiesOfCountry(countryId: string): AirportPlace[] {
  const cities = AIRPORT_PLACES.filter(
    (p) => p.kind === "city" && p.countryId === countryId
  );
  cities.sort((a, b) => {
    const pa = popularIndex(a.id);
    const pb = popularIndex(b.id);
    if (pa !== pb) return pa - pb;
    return a.city.localeCompare(b.city, "ko");
  });
  return cities;
}

function airportsOfCity(cityId: string): AirportPlace[] {
  return AIRPORT_PLACES.filter(
    (p) => p.kind === "airport" && p.cityId === cityId
  );
}

function candidateStrings(place: AirportPlace): string[] {
  const official =
    place.code && AIRPORT_OFFICIAL_NAMES[place.code]
      ? [AIRPORT_OFFICIAL_NAMES[place.code]]
      : [];
  return [
    place.name,
    place.city,
    place.country,
    place.code ?? "",
    formatAirportInputLabel(place),
    ...official,
    ...(place.aliases ?? []),
    ...place.keywords,
  ]
    .map((s) => normalizePlaceQuery(s))
    .filter(Boolean);
}

type RawMatch = {
  place: AirportPlace;
  score: number;
  matchedOn: MatchedOn;
  matchedCode?: string;
};

function scorePlace(place: AirportPlace, q: string): RawMatch | null {
  const codeNorm = place.code ? normalizePlaceQuery(place.code) : "";
  if (codeNorm && codeNorm === q) {
    return {
      place,
      score: 100,
      matchedOn: "code",
      matchedCode: place.code,
    };
  }

  const cityNorm = normalizePlaceQuery(place.city);
  const countryNorm = normalizePlaceQuery(place.country);
  const nameNorm = normalizePlaceQuery(place.name);
  const aliasNorms = (place.aliases ?? []).map(normalizePlaceQuery);

  if (place.kind === "country") {
    if (
      countryNorm === q ||
      nameNorm === q ||
      aliasNorms.includes(q) ||
      place.keywords.some((k) => normalizePlaceQuery(k) === q)
    ) {
      return { place, score: 90, matchedOn: "country" };
    }
  }

  if (place.kind === "city" && cityNorm === q) {
    return { place, score: 90, matchedOn: "name" };
  }

  if (
    place.kind === "country" ||
    place.kind === "city"
  ) {
    // no-op — exact country on city is handled as keyword/country below at lower tier for expansion
  }

  if (place.kind === "city" && countryNorm === q) {
    // 나라명으로 도시가 직접 잡히면 확장 단계에서 나라가 우선; 점수는 낮게
    return { place, score: 40, matchedOn: "country" };
  }

  const candidates = candidateStrings(place);
  let best: RawMatch | null = null;

  const consider = (score: number, matchedOn: MatchedOn) => {
    if (!best || score > best.score) {
      best = { place, score, matchedOn };
    }
  };

  for (const c of candidates) {
    if (c === q) {
      if (place.kind === "country") consider(90, "country");
      else if (c === cityNorm || c === nameNorm) consider(90, "name");
      else consider(70, "keyword");
      continue;
    }
    if (c.startsWith(q)) {
      consider(70, c === cityNorm || c === nameNorm ? "name" : "keyword");
      continue;
    }
    if (q.length >= 2 && c.includes(q)) {
      consider(40, "keyword");
    }
  }

  return best;
}

function compareResults(a: PlaceResult, b: PlaceResult): number {
  if (b.score !== a.score) return b.score - a.score;
  const kindRank = (p: AirportPlace) =>
    p.kind === "country" ? 0 : p.kind === "city" ? 1 : 2;
  const kr = kindRank(a.place) - kindRank(b.place);
  if (kr !== 0) return kr;
  const pa = popularIndex(a.place.id);
  const pb = popularIndex(b.place.id);
  if (pa !== pb) return pa - pb;
  const an = a.place.city || a.place.country || a.place.name;
  const bn = b.place.city || b.place.country || b.place.name;
  return an.localeCompare(bn, "ko");
}

function upsert(
  map: Map<string, PlaceResult>,
  next: PlaceResult
): void {
  const prev = map.get(next.place.id);
  if (!prev || next.score > prev.score) {
    map.set(next.place.id, next);
  } else if (next.score === prev.score) {
    // children / matchedCode 보강
    map.set(next.place.id, {
      ...prev,
      children: next.children ?? prev.children,
      parent: next.parent ?? prev.parent,
      matchedCode: next.matchedCode ?? prev.matchedCode,
      matchedOn:
        prev.matchedOn === "code" || next.matchedOn === "code"
          ? "code"
          : prev.matchedOn,
    });
  }
}

/**
 * 통합 장소 검색.
 * - all: 나라·도시·공항
 * - cities: 나라·도시 (공항코드 매칭 시 부모 도시로 승격)
 */
export function searchPlaces(
  query: string,
  options: { mode: SearchPlacesMode; limit?: number }
): PlaceResult[] {
  const limit = options.limit ?? 24;
  const mode = options.mode;
  const q = normalizePlaceQuery(query);

  if (!q) {
    if (mode === "cities") {
      return getPopularCities(limit).map((place) => ({
        place,
        score: 0,
        matchedOn: "name" as const,
      }));
    }
    const popular: PlaceResult[] = [];
    for (const id of POPULAR_PLACE_IDS) {
      const place = placeById(id);
      if (!place) continue;
      popular.push({ place, score: 0, matchedOn: "name" });
      if (popular.length >= limit) break;
    }
    return popular;
  }

  const rawMatches: RawMatch[] = [];
  for (const place of AIRPORT_PLACES) {
    const m = scorePlace(place, q);
    if (m) rawMatches.push(m);
  }

  const resultMap = new Map<string, PlaceResult>();

  // 나라 매칭 → 나라 + 소속 도시
  const matchedCountries = rawMatches.filter((m) => m.place.kind === "country");
  for (const m of matchedCountries) {
    upsert(resultMap, {
      place: m.place,
      score: m.score,
      matchedOn: m.matchedOn,
      children: citiesOfCountry(m.place.id),
    });
    for (const city of citiesOfCountry(m.place.id)) {
      upsert(resultMap, {
        place: city,
        parent: m.place,
        score: Math.min(m.score - 1, 89),
        matchedOn: "country",
        children: mode === "all" ? airportsOfCity(city.id) : undefined,
      });
    }
  }

  // 도시 매칭
  for (const m of rawMatches) {
    if (m.place.kind !== "city") continue;
    // 나라명으로만 걸린 도시는 나라 확장에서 이미 넣음 — 직접 도시명 매칭만 강화
    if (m.matchedOn === "country" && m.score <= 40) {
      const country = AIRPORT_PLACES.find(
        (p) =>
          p.kind === "country" &&
          (p.countryId === m.place.countryId || p.country === m.place.country)
      );
      if (country && matchedCountries.some((c) => c.place.id === country.id)) {
        continue;
      }
    }
    const children = airportsOfCity(m.place.id);
    upsert(resultMap, {
      place: m.place,
      score: m.score,
      matchedOn: m.matchedOn,
      matchedCode: m.matchedCode,
      children: mode === "all" ? children : undefined,
    });
    if (mode === "all") {
      for (const airport of children) {
        upsert(resultMap, {
          place: airport,
          parent: m.place,
          score: Math.min(m.score - 1, m.score),
          matchedOn: m.matchedOn,
        });
      }
    }
  }

  // 공항 매칭
  for (const m of rawMatches) {
    if (m.place.kind !== "airport") continue;
    const parent = m.place.cityId ? placeById(m.place.cityId) : undefined;
    const parentAlsoMatched = Boolean(
      parent && rawMatches.some((r) => r.place.id === parent.id)
    );

    if (mode === "cities") {
      if (parent) {
        upsert(resultMap, {
          place: parent,
          score: m.score,
          matchedOn: m.matchedOn === "code" ? "code" : m.matchedOn,
          matchedCode: m.matchedCode ?? m.place.code,
          children: undefined,
        });
      }
      continue;
    }

    // 도시 키워드에도 같은 코드/문자열이 있으면 도시 → 공항 순 (예: fuk)
    if (parent && parentAlsoMatched) {
      upsert(resultMap, {
        place: parent,
        score: m.score,
        matchedOn: m.matchedOn,
        matchedCode: m.matchedCode ?? m.place.code,
        children: airportsOfCity(parent.id),
      });
      upsert(resultMap, {
        place: m.place,
        parent,
        score: m.score - 1,
        matchedOn: m.matchedOn,
        matchedCode: m.matchedCode,
      });
      continue;
    }

    upsert(resultMap, {
      place: m.place,
      parent,
      score: m.score,
      matchedOn: m.matchedOn,
      matchedCode: m.matchedCode,
    });
    if (parent) {
      upsert(resultMap, {
        place: parent,
        score: Math.min(m.score - 1, 99),
        matchedOn: m.matchedOn,
        children: airportsOfCity(parent.id),
      });
    }
  }

  // cities 모드: 공항 항목 제거 (승격만 남김)
  if (mode === "cities") {
    for (const [id, r] of resultMap) {
      if (r.place.kind === "airport") resultMap.delete(id);
    }
  }

  const sorted = [...resultMap.values()].sort(compareResults);
  return sorted.slice(0, limit);
}

/** 도시+공항 검색 (기존 API 유지) */
export function searchAirportPlaces(query: string, limit = 24): AirportPlace[] {
  return searchPlaces(query, { mode: "all", limit }).map((r) => r.place);
}

/** 도시·나라만 검색 (기존 API 유지, 공항코드는 부모 도시로 승격) */
export function searchCityPlaces(query: string, limit = 24): AirportPlace[] {
  return searchPlaces(query, { mode: "cities", limit }).map((r) => r.place);
}

export function findAirportPlaceByQuery(query: string): AirportPlace | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const paren = trimmed.match(/\(([A-Za-z]{3})\)\s*$/);
  if (paren) {
    const byCode = AIRPORT_PLACES.find(
      (place) => place.code?.toUpperCase() === paren[1].toUpperCase()
    );
    if (byCode) return byCode;
  }

  const hits = searchPlaces(trimmed, { mode: "all", limit: 5 });
  const airportHit = hits.find((h) => h.place.kind === "airport");
  if (airportHit) return airportHit.place;
  return hits[0]?.place ?? null;
}
