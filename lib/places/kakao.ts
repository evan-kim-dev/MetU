import "server-only";

import {
  kindToKakaoCategory,
  mapKakaoDocument,
  type KakaoDocument,
} from "@/lib/places/kakao-map";
import type {
  Place,
  PlaceProvider,
  PlaceProviderCapabilities,
  PlaceSearchParams,
} from "@/lib/places/types";

const KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const TIMEOUT_MS = 8000;
const PAGE_SIZE = 15;

const CAPABILITIES: PlaceProviderCapabilities = {
  rating: false,
  openingHours: false,
  priceLevel: false,
};

function apiKey(): string | undefined {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  return key || undefined;
}

function authHeaders(): HeadersInit | null {
  const key = apiKey();
  if (!key) return null;
  return { Authorization: `KakaoAK ${key}` };
}

async function kakaoGet(
  url: string
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const headers = authHeaders();
  if (!headers) return { ok: false, status: 0, json: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (res.status === 429) {
      console.warn("[places/kakao] HTTP 429 quota/rate (key redacted)");
      return { ok: false, status: 429, json: null };
    }
    if (!res.ok) {
      console.warn(`[places/kakao] HTTP ${res.status} (key redacted)`);
      return { ok: false, status: res.status, json: null };
    }
    const json = await res.json();
    return { ok: true, status: res.status, json };
  } catch (error) {
    console.warn(
      "[places/kakao] request failed:",
      error instanceof Error ? error.message : "unknown"
    );
    return { ok: false, status: 0, json: null };
  } finally {
    clearTimeout(timer);
  }
}

export class KakaoPlaceProvider implements PlaceProvider {
  readonly id = "kakao" as const;
  readonly capabilities = CAPABILITIES;

  isConfigured(): boolean {
    return Boolean(apiKey());
  }

  async resolveCenter(
    city: string,
    _country?: string
  ): Promise<{ lat: number; lng: number } | null> {
    if (!this.isConfigured()) return null;

    const keywordUrl = `${KEYWORD_URL}?${new URLSearchParams({
      query: city,
      size: "1",
    })}`;
    const kw = await kakaoGet(keywordUrl);
    if (kw.ok) {
      const docs = (kw.json as { documents?: KakaoDocument[] })?.documents;
      const doc = docs?.[0];
      if (doc) {
        const lat = Number(doc.y);
        const lng = Number(doc.x);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
      }
    }

    const addressUrl = `${ADDRESS_URL}?${new URLSearchParams({
      query: city,
    })}`;
    const addr = await kakaoGet(addressUrl);
    if (addr.ok) {
      const docs = (
        addr.json as {
          documents?: Array<{
            x?: string;
            y?: string;
            address?: { x?: string; y?: string };
          }>;
        }
      )?.documents;
      const doc = docs?.[0];
      const x = doc?.x ?? doc?.address?.x;
      const y = doc?.y ?? doc?.address?.y;
      const lat = Number(y);
      const lng = Number(x);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
    return null;
  }

  async search(params: PlaceSearchParams): Promise<Place[]> {
    if (!this.isConfigured()) return [];

    const maxResults = Math.min(45, Math.max(1, params.maxResults ?? 30));
    const radius = Math.min(
      20000,
      Math.max(0, params.radiusMeters ?? 15000)
    );
    let center = params.center;
    if (!center) {
      center =
        (await this.resolveCenter(params.city, params.country)) ?? undefined;
    }

    const category = kindToKakaoCategory(params.kind);
    const out: Place[] = [];
    let page = 1;

    while (out.length < maxResults) {
      const qs = new URLSearchParams({
        query: `${params.city} ${params.query}`.trim(),
        size: String(PAGE_SIZE),
        page: String(page),
        sort: "accuracy",
      });
      if (category) qs.set("category_group_code", category);
      if (center) {
        qs.set("x", String(center.lng));
        qs.set("y", String(center.lat));
        qs.set("radius", String(radius));
      }

      const res = await kakaoGet(`${KEYWORD_URL}?${qs}`);
      if (!res.ok) return out;

      const json = res.json as {
        documents?: KakaoDocument[];
        meta?: { is_end?: boolean };
      };
      const docs = json.documents ?? [];
      for (const doc of docs) {
        const mapped = mapKakaoDocument(doc, params.city);
        if (mapped) out.push(mapped);
        if (out.length >= maxResults) break;
      }

      if (json.meta?.is_end || docs.length === 0) break;
      page += 1;
      if (page > 3) break; // Kakao 질의당 최대 45건
    }

    // attraction 이면 CT1(문화시설) 한 번 더 조회
    if (
      params.kind === "attraction" &&
      out.length < maxResults &&
      category === "AT4"
    ) {
      const qs = new URLSearchParams({
        query: `${params.city} ${params.query}`.trim(),
        category_group_code: "CT1",
        size: String(Math.min(PAGE_SIZE, maxResults - out.length)),
        page: "1",
        sort: "accuracy",
      });
      if (center) {
        qs.set("x", String(center.lng));
        qs.set("y", String(center.lat));
        qs.set("radius", String(radius));
      }
      const res = await kakaoGet(`${KEYWORD_URL}?${qs}`);
      if (res.ok) {
        const docs =
          (res.json as { documents?: KakaoDocument[] })?.documents ?? [];
        const seen = new Set(out.map((p) => p.providerPlaceId));
        for (const doc of docs) {
          const mapped = mapKakaoDocument(doc, params.city);
          if (mapped && !seen.has(mapped.providerPlaceId)) {
            out.push(mapped);
            seen.add(mapped.providerPlaceId);
          }
          if (out.length >= maxResults) break;
        }
      }
    }

    return out.slice(0, maxResults);
  }
}

export const kakaoPlaceProvider = new KakaoPlaceProvider();
