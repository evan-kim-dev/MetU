import { NextResponse } from "next/server";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  const limit = searchParams.get("limit")?.trim() ?? "20";

  const qs = new URLSearchParams({ limit });
  if (query) qs.set("query", query);

  try {
    const res = await backendFetch(`/flights/airport-codes/search?${qs.toString()}`);
    const payload = (await res.json().catch(() => ({}))) as
      | AirportCodesResponse
      | { detail?: string };

    if (!res.ok) {
      return NextResponse.json(
        { error: (payload as { detail?: string }).detail ?? "airport-codes-failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json({ error: "backend-unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "airport-codes-failed" }, { status: 500 });
  }
}
