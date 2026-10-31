import "server-only";

import {
  computeFxDisplayUnit,
  currencyDisplayMeta,
  normalizeCurrencyCode,
  type FxTarget,
} from "@/lib/fx/currencies";
import { resolveLiveKrwRate } from "@/lib/fx/server";
import { getOrSet } from "@/lib/server/cache";

const COUNTRIES_URL = "https://api.travelpayouts.com/data/ko/countries.json";
const COUNTRIES_CACHE_KEY = "fx:countries:ko";
const COUNTRIES_TTL_SEC = 30 * 24 * 3600;
const GEOCODE_TTL_SEC = 7 * 24 * 3600;
const FETCH_TIMEOUT_MS = 5_000;

export type TripCurrencyResult = FxTarget & { resolved: boolean };

type TravelpayoutsCountry = {
  code?: string;
  name?: string;
  currency?: string;
  name_translations?: { en?: string };
};

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCountriesJson(): Promise<TravelpayoutsCountry[]> {
  const res = await fetchWithTimeout(COUNTRIES_URL);
  if (!res.ok) throw new Error(`countries-http-${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("countries-invalid");
  return data as TravelpayoutsCountry[];
}

/** api_cache 30일. staleIfError 로 만료 후에도 이전 값 재사용. */
export async function getCountriesCached(): Promise<TravelpayoutsCountry[]> {
  const result = await getOrSet(
    COUNTRIES_CACHE_KEY,
    COUNTRIES_TTL_SEC,
    fetchCountriesJson,
    { staleIfError: true }
  );
  return result.value;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function matchCountryByName(
  query: string,
  countries: TravelpayoutsCountry[]
): TravelpayoutsCountry | null {
  const q = norm(query);
  if (!q) return null;

  // 슬래시·쉼표로 이어진 경우 앞부분도 후보로 둠 ("베트남/다낭")
  const heads = [q, ...q.split(/[/·,]/).map((p) => p.trim()).filter(Boolean)];

  for (const head of heads) {
    for (const c of countries) {
      const name = c.name ? norm(c.name) : "";
      const en = c.name_translations?.en
        ? norm(c.name_translations.en)
        : "";
      if (name && (head === name || head.includes(name) || name.includes(head))) {
        return c;
      }
      if (en && (head === en || head.includes(en) || en.includes(head))) {
        return c;
      }
    }
  }
  return null;
}

function findByCountryCode(
  code: string,
  countries: TravelpayoutsCountry[]
): TravelpayoutsCountry | null {
  const upper = code.trim().toUpperCase();
  if (!upper) return null;
  return countries.find((c) => (c.code ?? "").toUpperCase() === upper) ?? null;
}

function destinationQueryHead(destination: string): string {
  const raw = destination.trim();
  if (!raw) return "";
  const head = raw.split(/[,·]/)[0]?.trim() ?? raw;
  return head;
}

async function geocodeCountryCode(name: string): Promise<string | null> {
  const q = name.trim();
  if (!q) return null;
  const cacheKey = `fx:geocode:${norm(q)}`;

  try {
    const result = await getOrSet(
      cacheKey,
      GEOCODE_TTL_SEC,
      async () => {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&language=ko&count=1`;
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error(`geocode-http-${res.status}`);
        const data = (await res.json()) as {
          results?: Array<{ country_code?: string }>;
        };
        const code = data.results?.[0]?.country_code;
        if (!code || typeof code !== "string") {
          throw new Error("geocode-empty");
        }
        return { country_code: code.toUpperCase() };
      },
      { staleIfError: true }
    );
    return result.value.country_code;
  } catch (err) {
    console.error("[fx] geocode", err);
    return null;
  }
}

async function buildTarget(
  currencyCode: string,
  resolved: boolean
): Promise<TripCurrencyResult> {
  const code = normalizeCurrencyCode(currencyCode) ?? "USD";
  const { symbol, label } = currencyDisplayMeta(code);
  let unit = 1;
  try {
    const rate = await resolveLiveKrwRate(code);
    if (rate && rate.krw > 0) {
      unit = computeFxDisplayUnit(rate.krw);
    }
  } catch (err) {
    console.error("[fx] unit-rate", err);
  }
  return { code, symbol, label, unit, resolved };
}

/**
 * 여행지 → 현지 통화.
 * 1) Travelpayouts countries.json name / name_translations.en
 * 2) Open-Meteo geocoding → country_code → currency
 * 3) 실패 시 USD + resolved:false
 */
export async function resolveTripCurrency(input: {
  country?: string | null;
  destination?: string | null;
}): Promise<TripCurrencyResult> {
  const country = input.country?.trim() ?? "";
  const destination = input.destination?.trim() ?? "";

  let countries: TravelpayoutsCountry[] = [];
  try {
    countries = await getCountriesCached();
  } catch (err) {
    console.error("[fx] countries", err);
  }

  if (countries.length > 0 && country) {
    const hit = matchCountryByName(country, countries);
    const cur = hit?.currency ? normalizeCurrencyCode(hit.currency) : null;
    if (cur) return buildTarget(cur, true);
  }

  if (countries.length > 0 && destination) {
    const head = destinationQueryHead(destination);
    if (head) {
      const cc = await geocodeCountryCode(head);
      if (cc) {
        const hit = findByCountryCode(cc, countries);
        const cur = hit?.currency ? normalizeCurrencyCode(hit.currency) : null;
        if (cur) return buildTarget(cur, true);
      }
    }
  }

  // country 가 비어 있어도 destination 문자열에 국가명이 섞인 경우
  if (countries.length > 0 && !country && destination) {
    const hit = matchCountryByName(destination, countries);
    const cur = hit?.currency ? normalizeCurrencyCode(hit.currency) : null;
    if (cur) return buildTarget(cur, true);
  }

  return buildTarget("USD", false);
}
