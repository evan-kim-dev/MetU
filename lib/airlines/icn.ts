export type IcnAirlineProfile = {
  iata: string;
  icao: string;
  name: string;
  image?: string;
  tel?: string;
  icTel?: string;
  source?: string;
};

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

export async function fetchIcnAirlineProfiles(
  carriers: string[]
): Promise<Record<string, IcnAirlineProfile>> {
  const unique = [...new Set(carriers.map((c) => c.trim()).filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (carrier) => {
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

export async function searchIcnAirlineCodes(
  query: string
): Promise<IcnAirlineProfile[]> {
  const params = new URLSearchParams({ query, limit: "14" });
  const res = await fetch(`/api/flights/icn-airlines?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { airlines?: IcnAirlineProfile[] };
  return data.airlines ?? [];
}
