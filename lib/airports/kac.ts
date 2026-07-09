import type { AirportPlace } from "@/lib/airports/data";
import { AIRPORT_PLACES } from "@/lib/airports/data";

export type KacAirport = {
  code: string;
  name: string;
  nameEn?: string;
  nameJa?: string;
  nameZh?: string;
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

export function kacAirportToPlace(airport: KacAirport): AirportPlace {
  const staticMatch = AIRPORT_PLACES.find(
    (place) => place.code?.toUpperCase() === airport.code?.toUpperCase()
  );
  const keywords = [
    airport.name,
    airport.nameEn ?? "",
    airport.nameJa ?? "",
    airport.nameZh ?? "",
    airport.code,
    airport.city,
    airport.country,
    airport.label,
    ...(staticMatch?.keywords ?? []),
  ].filter(Boolean);

  return {
    id: staticMatch?.id ?? `kac-${airport.code || airport.name}`,
    kind: "airport",
    name: staticMatch?.name ?? airport.label,
    city: staticMatch?.city ?? (airport.city || airport.name),
    country: staticMatch?.country ?? (airport.country || ""),
    code: airport.code || undefined,
    cityId: staticMatch?.cityId,
    keywords,
  };
}

export function mergeAirportPlaces(
  staticResults: AirportPlace[],
  apiResults: AirportPlace[],
  limit = 14
): AirportPlace[] {
  const merged: AirportPlace[] = [];
  const seen = new Set<string>();

  for (const place of [...apiResults, ...staticResults]) {
    const key = place.code?.toUpperCase() || place.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(place);
    if (merged.length >= limit) break;
  }

  return merged;
}

export async function searchAirportsFromApi(
  query: string,
  limit = 14
): Promise<AirportPlace[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const qs = new URLSearchParams({ limit: String(limit), query: trimmed });

  try {
    const res = await fetch(`/api/flights/airport-codes?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];

    const payload = (await res.json()) as AirportCodesResponse;
    if (!payload.airports?.length) return [];

    return payload.airports.map(kacAirportToPlace);
  } catch {
    return [];
  }
}
