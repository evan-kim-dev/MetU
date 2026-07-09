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

function naverFallbackWarning(reason: string | undefined): string {
  if (reason === "naver-api-blocked" || reason === "naver-api-unavailable") {
    return "네이버 항공 API가 서버 요청을 차단해 Google Flights로 조회했어요. 네이버에서 직접 보려면 아래 링크를 이용해주세요.";
  }
  if (reason === "naver-api-rate-limited") {
    return "네이버 항공 API 요청 제한에 걸려 Google Flights로 조회했어요. 잠시 후 다시 시도해주세요.";
  }
  if (reason === "naver-flights-empty") {
    return "해당 조건의 네이버 직항 항공권이 없어 Google Flights로 조회했어요.";
  }
  return "네이버 항공권 결과가 없어 Google Flights로 조회했어요.";
}

async function searchWithNaverFlights(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults: number;
  cabinClass: string;
  sortBy: string;
}): Promise<
  | { ok: true; flights: UiFlightItem[]; bookingUrl?: string }
  | { ok: false; message: string; bookingUrl?: string }
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

  const res = await backendFetch(`/flights/naver-search?${qs.toString()}`);
  const payload = (await res.json().catch(() => ({}))) as SearchResponse;
  const naverBookingUrl = payload.meta?.booking_search_url;

  if (!res.ok) {
    if (payload.detail === "airport-not-found") {
      return { ok: false, message: "airport-not-found", bookingUrl: naverBookingUrl };
    }
    return {
      ok: false,
      message: payload.meta?.error ?? "naver-flights-empty",
      bookingUrl: naverBookingUrl,
    };
  }

  const validFlights = filterValidFlights(payload.flights ?? []);
  if (validFlights.length === 0) {
    return {
      ok: false,
      message: payload.meta?.error ?? "naver-flights-empty",
      bookingUrl: naverBookingUrl,
    };
  }

  return {
    ok: true,
    flights: validFlights,
    bookingUrl: naverBookingUrl,
  };
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

  const searchInput = {
    origin,
    destination,
    departDate,
    returnDate,
    adults,
    cabinClass,
    sortBy,
  };

  try {
    const naverResult = await searchWithNaverFlights(searchInput);
    if (naverResult.ok) {
      return NextResponse.json({
        flights: naverResult.flights,
        source: "naver-flights",
        bookingUrl: naverResult.bookingUrl,
        warning:
          cabinClass !== "economy" || adults > 1
            ? "네이버 항공권은 선택한 인원·좌석 등급 기준으로 조회했어요."
            : undefined,
      });
    }

    if (naverResult.message === "airport-not-found") {
      return NextResponse.json(
        {
          error:
            "출발지/도착지를 인식하지 못했어요. 도시명(서울, 도쿄) 또는 공항코드(ICN, NRT)로 입력해주세요.",
        },
        { status: 400 }
      );
    }

    const googleResult = await searchWithGoogleFlights(searchInput);

    if (googleResult.ok) {
      return NextResponse.json({
        flights: googleResult.flights,
        source: "google-flights",
        bookingUrl: googleResult.bookingUrl,
        naverBookingUrl: naverResult.bookingUrl,
        warning: naverFallbackWarning(naverResult.message),
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
      naverBookingUrl: naverResult.bookingUrl,
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
