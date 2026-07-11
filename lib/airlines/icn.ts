export type IcnAirlineProfile = {
  iata: string;
  icao: string;
  name: string;
  image?: string;
  tel?: string;
  icTel?: string;
  source?: string;
};

function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

function matchProfile(
  carrier: string,
  airlines: IcnAirlineProfile[]
): IcnAirlineProfile | null {
  const key = normalizeKey(carrier);
  if (!key) return null;

  return (
    airlines.find(
      (a) =>
        normalizeKey(a.iata) === key ||
        normalizeKey(a.icao) === key ||
        normalizeKey(a.name).includes(key) ||
        key.includes(normalizeKey(a.iata))
    ) ?? null
  );
}

export async function fetchIcnAirlineProfile(
  input: { carrier?: string; airlineIata?: string; airlineIcao?: string }
): Promise<IcnAirlineProfile | null> {
  const params = new URLSearchParams();
  if (input.airlineIata) params.set("airline_iata", input.airlineIata);
  if (input.airlineIcao) params.set("airline_icao", input.airlineIcao);
  if (input.carrier) params.set("carrier", input.carrier);
  if ([...params.keys()].length === 0) return null;

  const res = await fetch(`/api/flights/icn-airlines?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as IcnAirlineProfile;
}

/** Resolve many carriers with one list fetch (avoids N+1). */
export async function fetchIcnAirlineProfiles(
  carriers: string[]
): Promise<Record<string, IcnAirlineProfile>> {
  const unique = [...new Set(carriers.map((c) => c.trim()).filter(Boolean))];
  if (unique.length === 0) return {};

  const res = await fetch("/api/flights/icn-airlines", { cache: "no-store" });
  if (!res.ok) {
    // Fallback: limited parallel lookups
    const entries = await Promise.all(
      unique.slice(0, 8).map(async (carrier) => {
        const profile = await fetchIcnAirlineProfile({ carrier });
        return [carrier, profile] as const;
      })
    );
    const map: Record<string, IcnAirlineProfile> = {};
    for (const [carrier, profile] of entries) {
      if (profile) map[carrier] = profile;
    }
    return map;
  }

  const payload = (await res.json()) as
    | { airlines?: IcnAirlineProfile[] }
    | IcnAirlineProfile[];
  const airlines = Array.isArray(payload)
    ? payload
    : (payload.airlines ?? []);

  const map: Record<string, IcnAirlineProfile> = {};
  for (const carrier of unique) {
    const profile = matchProfile(carrier, airlines);
    if (profile) map[carrier] = profile;
  }
  return map;
}
