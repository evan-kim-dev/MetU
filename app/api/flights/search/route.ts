import { NextResponse } from "next/server";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";
import { filterValidFlights } from "@/lib/flights/validate";

type FlightItem = {
  id: string;
  price: string;
  carrier: string;
  outbound: string;
  inbound: string;
  route: string;
  duration: string;
  stops: string;
  bookingUrl?: string;
};

type SearchResponse = {
  flights?: FlightItem[];
  source?: string;
  meta?: {
    booking_search_url?: string;
    error?: string;
  };
  detail?: string;
};

type UiFlightItem = FlightItem;

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function searchWithGoogleFlights(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults: number;
  cabinClass: string;
  sortBy: string;
}): Promise<
  | { ok: true; flights: UiFlightItem[]; bookingUrl?: string }
  | { ok: false; status: number; message: string }
> {
  const qs = new URLSearchParams({
    origin: input.origin,
    destination: input.destination,
    depart_date: input.departDate,
    return_date: input.returnDate,
    adults: String(input.adults),
    cabin_class: input.cabinClass,
    sort_by: input.sortBy,
    limit: "8",
  });

  const res = await backendFetch(`/flights/google-search?${qs.toString()}`);
  const payload = (await res.json().catch(() => ({}))) as SearchResponse;

  if (!res.ok) {
    if (payload.detail === "airport-not-found") {
      return { ok: false, status: res.status, message: "airport-not-found" };
    }
    return {
      ok: false,
      status: res.status,
      message: "google-flights-empty",
    };
  }

  const validFlights = filterValidFlights(payload.flights ?? []);
  if (validFlights.length === 0) {
    return {
      ok: false,
      status: 200,
      message: "google-flights-empty",
    };
  }

  return {
    ok: true,
    flights: validFlights,
    bookingUrl: payload.meta?.booking_search_url,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin")?.trim() ?? "";
  const destination = searchParams.get("destination")?.trim() ?? "";
  const departDate = searchParams.get("departDate")?.trim() ?? "";
  const returnDate = searchParams.get("returnDate")?.trim() ?? "";
  const adults = Number(searchParams.get("adults") ?? "1");
  const cabinClass = searchParams.get("cabinClass")?.trim() || "economy";
  const sortBy = searchParams.get("sortBy")?.trim() || "best";

  if (!origin || !destination || !isDate(departDate) || !isDate(returnDate)) {
    return NextResponse.json({ error: "invalid-params" }, { status: 400 });
  }
  if (!Number.isFinite(adults) || adults < 1 || adults > 9) {
    return NextResponse.json({ error: "invalid-adults" }, { status: 400 });
  }

  try {
    const googleResult = await searchWithGoogleFlights({
      origin,
      destination,
      departDate,
      returnDate,
      adults,
      cabinClass,
      sortBy,
    });

    if (googleResult.ok) {
      return NextResponse.json({
        flights: googleResult.flights,
        source: "google-flights",
        bookingUrl: googleResult.bookingUrl,
      });
    }

    if (googleResult.message === "airport-not-found") {
      return NextResponse.json(
        {
          error:
            "출발지/도착지를 인식하지 못했어요. 도시명(서울, 도쿄) 또는 공항코드(ICN, NRT)로 입력해주세요.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      flights: [],
      source: "google-flights",
      info: "no-valid-flights",
    });
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json({ error: "backend-unavailable" }, { status: 503 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `flight-search-failed:${error.message}`
            : "flight-search-failed",
      },
      { status: 500 }
    );
  }
}
