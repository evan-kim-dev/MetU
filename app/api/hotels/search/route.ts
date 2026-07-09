import { NextResponse } from "next/server";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";

type HotelItem = {
  id: string;
  name: string;
  area: string;
  rating?: number | null;
  reviewCount?: number | null;
  price: string;
  badge: string;
  bookingUrl?: string;
};

type HotelSearchResponse = {
  hotels?: HotelItem[];
  source?: string;
  meta?: {
    booking_search_url?: string;
    error?: string;
    destination_code?: string;
  };
  detail?: string;
};

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function fallbackWarning(error: string | undefined): string | undefined {
  if (!error || error === "hotelbeds-key-missing") {
    return "Hotelbeds API 키가 없어 Google Hotels 링크로 안내해요. 키를 설정하면 실시간 요금을 조회할 수 있어요.";
  }
  if (error === "hotelbeds-no-rates") {
    return "해당 날짜·지역에 Hotelbeds 요금이 없어 Google Hotels로 확인해주세요.";
  }
  if (error.startsWith("hotelbeds-")) {
    return "Hotelbeds 조회에 실패해 Google Hotels 링크를 제공해요.";
  }
  return undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const destination = searchParams.get("destination")?.trim() ?? "";
  const checkIn = searchParams.get("checkIn")?.trim() ?? "";
  const checkOut = searchParams.get("checkOut")?.trim() ?? "";
  const adults = Number(searchParams.get("adults") ?? "2");
  const rooms = Number(searchParams.get("rooms") ?? "1");
  const children = Number(searchParams.get("children") ?? "0");
  const sortBy = searchParams.get("sortBy")?.trim() || "best";

  if (!destination || !isDate(checkIn) || !isDate(checkOut)) {
    return NextResponse.json({ error: "invalid-params" }, { status: 400 });
  }
  if (!Number.isFinite(adults) || adults < 1 || adults > 9) {
    return NextResponse.json({ error: "invalid-adults" }, { status: 400 });
  }
  if (!Number.isFinite(rooms) || rooms < 1 || rooms > 4) {
    return NextResponse.json({ error: "invalid-rooms" }, { status: 400 });
  }

  const qs = new URLSearchParams({
    destination,
    check_in: checkIn,
    check_out: checkOut,
    adults: String(adults),
    rooms: String(rooms),
    children: String(children),
    sort_by: sortBy,
    limit: "8",
  });

  try {
    const res = await backendFetch(`/hotels/search?${qs.toString()}`);
    const payload = (await res.json().catch(() => ({}))) as HotelSearchResponse;

    if (!res.ok) {
      if (payload.detail === "destination-not-found") {
        return NextResponse.json(
          {
            error:
              "지역을 인식하지 못했어요. 도쿄, 오사카, 서울처럼 도시명으로 입력해주세요.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: payload.detail ?? "hotel-search-failed" },
        { status: res.status }
      );
    }

    const hotels = payload.hotels ?? [];
    const bookingUrl = payload.meta?.booking_search_url;
    const warning = fallbackWarning(payload.meta?.error);

    if (hotels.length === 0) {
      return NextResponse.json({
        hotels: [],
        source: payload.source ?? "google-hotels",
        bookingUrl,
        warning,
        info: "no-hotels",
      });
    }

    return NextResponse.json({
      hotels,
      source: payload.source ?? "hotelbeds",
      bookingUrl,
      warning,
    });
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json({ error: "backend-unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "hotel-search-failed" }, { status: 500 });
  }
}
