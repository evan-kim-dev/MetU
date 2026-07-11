import { NextResponse } from "next/server";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";
import { searchAirportPlaces } from "@/lib/airports/data";

type KacAirport = {
  code: string;
  name: string;
  nameEn?: string;
  city: string;
  country: string;
  label: string;
};

type AirportCodesResponse = {
  airports?: KacAirport[];
  source?: string;
  total?: number;
  error?: string;
};

function staticFallback(query: string | null, limit: number) {
  const places = searchAirportPlaces(query ?? "", limit);
  return {
    airports: places.map((place) => ({
      code: place.code ?? "",
      name: place.name,
      city: place.city,
      country: place.country,
      label: place.code ? `${place.name}` : place.name,
    })),
    source: "static-fallback",
    total: places.length,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? null;
  const limitRaw = Number(searchParams.get("limit")?.trim() ?? "28");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 50)
    : 28;

  const qs = new URLSearchParams({ limit: String(limit) });
  if (query) qs.set("query", query);

  try {
    const res = await backendFetch(`/flights/airport-codes/search?${qs.toString()}`);
    const payload = (await res.json().catch(() => ({}))) as
      | AirportCodesResponse
      | { detail?: string };

    if (!res.ok) {
      return NextResponse.json(staticFallback(query, limit));
    }

    const data = payload as AirportCodesResponse;
    if (!data.airports?.length) {
      return NextResponse.json(staticFallback(query, limit));
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json(staticFallback(query, limit));
    }
    return NextResponse.json(staticFallback(query, limit));
  }
}
