import { NextResponse } from "next/server";
import {
  normalizeUpstreamPlaces,
  searchLocalPlaceItems,
  type PlaceAutocompleteMode,
} from "@/lib/places/autocomplete";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 10;

const UPSTREAM =
  "https://autocomplete.travelpayouts.com/places2";
const CACHE_HEADER =
  "public, s-maxage=86400, stale-while-revalidate=604800";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function parseMode(raw: string | null): PlaceAutocompleteMode {
  return raw === "cities" ? "cities" : "all";
}

function parseLimit(raw: string | null): number {
  if (!raw) return 10;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 10;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

function jsonOk(
  body: { source: "remote" | "local"; items: unknown },
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": CACHE_HEADER },
  });
}

export async function GET(request: Request) {
  const rate = checkRateLimit(`places-autocomplete:${clientIp(request)}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate-limit-exceeded" },
      {
        status: 429,
        headers: rate.retryAfterSec
          ? { "Retry-After": String(rate.retryAfterSec) }
          : undefined,
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 1 || q.length > 40) {
    return NextResponse.json({ error: "invalid-query" }, { status: 400 });
  }

  const mode = parseMode(searchParams.get("mode"));
  const limit = parseLimit(searchParams.get("limit"));

  const localFallback = () =>
    jsonOk({
      source: "local",
      items: searchLocalPlaceItems(q, mode, limit),
    });

  const upstreamUrl = new URL(UPSTREAM);
  upstreamUrl.searchParams.set("term", q);
  upstreamUrl.searchParams.set("locale", "ko");
  upstreamUrl.searchParams.append("types[]", "country");
  upstreamUrl.searchParams.append("types[]", "city");
  upstreamUrl.searchParams.append("types[]", "airport");

  try {
    const res = await fetch(upstreamUrl.toString(), {
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.warn("[api/places/autocomplete] upstream status", res.status);
      return localFallback();
    }
    const raw: unknown = await res.json();
    const items = normalizeUpstreamPlaces(raw, q, mode, limit);
    if (items.length === 0 && Array.isArray(raw) === false) {
      return localFallback();
    }
    return jsonOk({ source: "remote", items });
  } catch (error) {
    console.warn(
      "[api/places/autocomplete]",
      error instanceof Error ? error.message : "unknown"
    );
    return localFallback();
  }
}
