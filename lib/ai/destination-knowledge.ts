import type { LatLng } from "@/lib/route/types";

const FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent": "MetUTravelPlanner/1.0 (https://met-u.vercel.app; travel-itinerary)",
};

export type DestinationAttraction = {
  name: string;
  detail: string;
  lat?: number;
  lng?: number;
};

export type DestinationKnowledge = {
  city: string;
  country: string;
  summary: string;
  attractions: DestinationAttraction[];
  source: "wiki+osm" | "wiki" | "osm" | "empty";
};

type WikiSearchHit = {
  title: string;
  snippet?: string;
};

async function geocodeCityCenter(
  city: string,
  country: string
): Promise<LatLng | null> {
  const query = [city, country].filter(Boolean).join(", ");
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city
    )}&count=3&language=ko&format=json`;
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        results?: {
          name?: string;
          latitude: number;
          longitude: number;
          country?: string;
        }[];
      };
      const results = json.results ?? [];
      const countryLower = country.toLowerCase();
      const preferred =
        results.find((r) =>
          countryLower
            ? (r.country ?? "").toLowerCase().includes(countryLower) ||
              countryLower.includes((r.country ?? "").toLowerCase())
            : true
        ) ?? results[0];
      if (preferred) {
        return { lat: preferred.latitude, lng: preferred.longitude };
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query || city);
    url.searchParams.set("limit", "1");
    url.searchParams.set("lang", "en");
    const res = await fetch(url.toString(), {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const coords = json.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    return { lat: coords[1], lng: coords[0] };
  } catch {
    return null;
  }
}

async function wikiOpenSearch(
  lang: "ko" | "en",
  query: string
): Promise<WikiSearchHit[]> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", "5");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const res = await fetch(url.toString(), {
    headers: FETCH_HEADERS,
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    query?: { search?: { title: string; snippet?: string }[] };
  };
  return (json.query?.search ?? []).map((s) => ({
    title: s.title,
    snippet: s.snippet?.replace(/<[^>]+>/g, "") ?? "",
  }));
}

async function wikiExtract(
  lang: "ko" | "en",
  title: string
): Promise<string | null> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const res = await fetch(url.toString(), {
    headers: FETCH_HEADERS,
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { extract?: string }> };
  };
  const pages = json.query?.pages ?? {};
  const first = Object.values(pages)[0];
  const text = first?.extract?.trim();
  if (!text) return null;
  return text.slice(0, 600);
}

async function fetchWikiSummary(
  city: string,
  country: string
): Promise<{ summary: string; pageTitle: string | null }> {
  const queries = [
    `${city} ${country}`.trim(),
    city,
    `${city} (city)`,
  ].filter(Boolean);

  for (const lang of ["ko", "en"] as const) {
    for (const q of queries) {
      try {
        const hits = await wikiOpenSearch(lang, q);
        const hit = hits[0];
        if (!hit) continue;
        const extract = await wikiExtract(lang, hit.title);
        if (extract && extract.length >= 40) {
          return { summary: extract, pageTitle: hit.title };
        }
        if (hit.snippet && hit.snippet.length >= 20) {
          return { summary: hit.snippet, pageTitle: hit.title };
        }
      } catch {
        /* try next */
      }
    }
  }
  return { summary: "", pageTitle: null };
}

async function fetchOverpassAttractions(
  center: LatLng,
  limit = 16
): Promise<DestinationAttraction[]> {
  const radius = 9000;
  const query = `
[out:json][timeout:18];
(
  node["tourism"="attraction"](around:${radius},${center.lat},${center.lng});
  node["tourism"="museum"](around:${radius},${center.lat},${center.lng});
  node["tourism"="viewpoint"](around:${radius},${center.lat},${center.lng});
  node["historic"="monument"](around:${radius},${center.lat},${center.lng});
  node["leisure"="park"]["name"](around:${radius},${center.lat},${center.lng});
  way["tourism"="attraction"](around:${radius},${center.lat},${center.lng});
  way["tourism"="museum"](around:${radius},${center.lat},${center.lng});
);
out center ${limit};
`.trim();

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        ...FETCH_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(query)}`,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      elements?: Array<{
        type: string;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: {
          name?: string;
          "name:ko"?: string;
          "name:en"?: string;
          tourism?: string;
          historic?: string;
          leisure?: string;
          description?: string;
        };
      }>;
    };

    const seen = new Set<string>();
    const out: DestinationAttraction[] = [];
    for (const el of json.elements ?? []) {
      const tags = el.tags ?? {};
      const name =
        tags["name:ko"]?.trim() ||
        tags.name?.trim() ||
        tags["name:en"]?.trim();
      if (!name || name.length < 2) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const kind =
        tags.tourism || tags.historic || tags.leisure || "attraction";
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      const detailBase =
        tags.description?.trim() ||
        `${name}은(는) 현지에서 자주 찾는 ${kind} 포인트예요. 1~2시간 여유를 두고 둘러보세요.`;

      out.push({
        name,
        detail: detailBase.slice(0, 180),
        lat,
        lng,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Wikivoyage "See" section-ish via extract of city page (best-effort). */
async function fetchWikivoyageHints(
  city: string
): Promise<DestinationAttraction[]> {
  for (const lang of ["en", "ko"] as const) {
    try {
      const host =
        lang === "en" ? "en.wikivoyage.org" : "ko.wikivoyage.org";
      const searchUrl = new URL(`https://${host}/w/api.php`);
      searchUrl.searchParams.set("action", "query");
      searchUrl.searchParams.set("list", "search");
      searchUrl.searchParams.set("srsearch", city);
      searchUrl.searchParams.set("srlimit", "3");
      searchUrl.searchParams.set("format", "json");
      searchUrl.searchParams.set("origin", "*");
      const searchRes = await fetch(searchUrl.toString(), {
        headers: FETCH_HEADERS,
        next: { revalidate: 86400 },
      });
      if (!searchRes.ok) continue;
      const searchJson = (await searchRes.json()) as {
        query?: { search?: { title: string }[] };
      };
      const title = searchJson.query?.search?.[0]?.title;
      if (!title) continue;

      const extractUrl = new URL(`https://${host}/w/api.php`);
      extractUrl.searchParams.set("action", "query");
      extractUrl.searchParams.set("prop", "extracts");
      extractUrl.searchParams.set("explaintext", "1");
      extractUrl.searchParams.set("exchars", "1800");
      extractUrl.searchParams.set("titles", title);
      extractUrl.searchParams.set("format", "json");
      extractUrl.searchParams.set("origin", "*");
      const extractRes = await fetch(extractUrl.toString(), {
        headers: FETCH_HEADERS,
        next: { revalidate: 86400 },
      });
      if (!extractRes.ok) continue;
      const extractJson = (await extractRes.json()) as {
        query?: { pages?: Record<string, { extract?: string }> };
      };
      const text = Object.values(extractJson.query?.pages ?? {})[0]?.extract;
      if (!text) continue;

      // Pull capitalized/proper-looking place names after bullets or newlines (heuristic)
      const lines = text
        .split(/\n+/)
        .map((l) => l.replace(/^[\s*#-]+/, "").trim())
        .filter((l) => l.length > 3 && l.length < 80);

      const attractions: DestinationAttraction[] = [];
      const seen = new Set<string>();
      for (const line of lines) {
        // Prefer lines that look like attraction headers
        if (/^(See|Do|Eat|Sleep|Get|Buy|Drink|Understand|Talk)/i.test(line)) {
          continue;
        }
        if (!/[A-Z가-힣]/.test(line[0] ?? "")) continue;
        if (/^It |^The |^This |^There |^You |이 |그 |저 |그리고|하지만/.test(line)) {
          continue;
        }
        const name = line.split(/[.·:—\-–]/)[0]?.trim() ?? "";
        if (name.length < 3 || name.length > 48) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        attractions.push({
          name,
          detail: `${name}은(는) ${city} 여행에서 빠지기 쉬운 핵심 스팟이에요. 동선에 맞춰 1~2시간 정도 머물러 보세요.`,
        });
        if (attractions.length >= 10) break;
      }
      if (attractions.length >= 3) return attractions;
    } catch {
      /* next lang */
    }
  }
  return [];
}

/**
 * 전 국가 공통: 위키 + OSM으로 목적지 요약·실명 명소를 가져온다.
 * 서버(Next API / enrich)에서 호출하는 것을 권장.
 */
export async function fetchDestinationKnowledge(
  city: string,
  country: string
): Promise<DestinationKnowledge> {
  const cleanCity = city.trim();
  const cleanCountry = country.trim();
  if (!cleanCity) {
    return {
      city: cleanCity,
      country: cleanCountry,
      summary: "",
      attractions: [],
      source: "empty",
    };
  }

  const [center, wiki] = await Promise.all([
    geocodeCityCenter(cleanCity, cleanCountry),
    fetchWikiSummary(cleanCity, cleanCountry),
  ]);

  let attractions: DestinationAttraction[] = [];
  let source: DestinationKnowledge["source"] = "empty";

  if (center) {
    attractions = await fetchOverpassAttractions(center, 16);
    if (attractions.length > 0) {
      source = wiki.summary ? "wiki+osm" : "osm";
    }
  }

  if (attractions.length < 4) {
    const voyage = await fetchWikivoyageHints(cleanCity);
    const seen = new Set(attractions.map((a) => a.name.toLowerCase()));
    for (const a of voyage) {
      if (seen.has(a.name.toLowerCase())) continue;
      attractions.push(a);
      seen.add(a.name.toLowerCase());
    }
    if (attractions.length > 0 && source === "empty") {
      source = wiki.summary ? "wiki" : "osm";
    } else if (wiki.summary && attractions.length > 0) {
      source = "wiki+osm";
    } else if (wiki.summary) {
      source = "wiki";
    }
  }

  return {
    city: cleanCity,
    country: cleanCountry,
    summary:
      wiki.summary ||
      `${cleanCity}${cleanCountry ? ` (${cleanCountry})` : ""} 여행 목적지예요. 시내 중심과 대표 스팟을 기준으로 일정을 짜요.`,
    attractions: attractions.slice(0, 18),
    source,
  };
}

/** 프롬프트/RAG용 컨텍스트 문자열 */
export function knowledgeToRagContexts(
  knowledge: DestinationKnowledge
): string[] {
  const contexts: string[] = [];
  if (knowledge.summary) {
    contexts.push(`[CITY_SUMMARY] ${knowledge.summary}`);
  }
  if (knowledge.attractions.length > 0) {
    contexts.push(
      `[DESTINATION_ATTRACTIONS]\n${knowledge.attractions
        .map((a, i) => `${i + 1}. ${a.name} — ${a.detail}`)
        .join("\n")}`
    );
  }
  return contexts;
}
