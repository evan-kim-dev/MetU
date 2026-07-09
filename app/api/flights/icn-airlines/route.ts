import { NextResponse } from "next/server";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";

type IcnAirlineProfile = {
  iata: string;
  icao: string;
  name: string;
  image?: string;
  tel?: string;
  icTel?: string;
  source?: string;
};

type IcnAirlinesListResponse = {
  airlines?: IcnAirlineProfile[];
  source?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const airlineIata = searchParams.get("airline_iata")?.trim();
  const airlineIcao = searchParams.get("airline_icao")?.trim();
  const carrier = searchParams.get("carrier")?.trim();
  const query = searchParams.get("query")?.trim();

  const qs = new URLSearchParams();
  if (airlineIata) qs.set("airline_iata", airlineIata);
  if (airlineIcao) qs.set("airline_icao", airlineIcao);
  if (carrier) qs.set("carrier", carrier);

  const path = query
    ? `/flights/icn-airlines/codes?${new URLSearchParams({ query, limit: "20" }).toString()}`
    : `/flights/icn-airlines${qs.toString() ? `?${qs.toString()}` : ""}`;

  try {
    const res = await backendFetch(path);
    const payload = (await res.json().catch(() => ({}))) as
      | IcnAirlineProfile
      | IcnAirlinesListResponse
      | { detail?: string };

    if (!res.ok) {
      return NextResponse.json(
        { error: (payload as { detail?: string }).detail ?? "icn-airlines-failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json({ error: "backend-unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "icn-airlines-failed" }, { status: 500 });
  }
}
