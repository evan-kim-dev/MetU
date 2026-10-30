import { describe, expect, it, vi } from "vitest";
import { buildAgodaFlightSearchUrl } from "@/lib/flights/agoda-url";
import { buildGoogleFlightsSearchUrl } from "@/lib/flights/google-flights-url";
import { buildNaverFlightsUrl } from "@/lib/flights/naver-flights-url";
import { buildAgodaHotelSearchUrl } from "@/lib/hotels/agoda-url";
import { searchAirportPlaces } from "@/lib/airports/search";
import { fetchPlanFlightQuote } from "@/lib/flights/plan-flight-quote";
import { fetchPlanHotelQuote } from "@/lib/hotels/plan-hotel-quote";
import type { TripRecommendation } from "@/lib/ai/types";

const plan = {
  origin: "인천",
  destination: "도쿄",
  people: 2,
  nights: 3,
  totalBudget: 1_000_000,
  form: {
    origin: "인천 (ICN)",
    destination: "도쿄 (NRT)",
    dateType: "specific",
    startDate: "2026-12-01",
    endDate: "2026-12-04",
  },
  flight: {
    price: "350000",
    airline: "KE",
    route: "ICN-NRT",
    schedule: "10:00",
  },
  hotel: {
    total: 300000,
    pricePerNight: 100000,
    name: "Hotel",
    area: "시부야",
    nights: 3,
  },
} as unknown as TripRecommendation;

describe("travel deeplinks", () => {
  it("embeds origin/destination/dates/adults and Agoda cid", () => {
    const google = buildGoogleFlightsSearchUrl({
      origin: "ICN",
      destination: "NRT",
      departDate: "2026-12-01",
      returnDate: "2026-12-04",
      adults: 2,
    });
    expect(google).toContain("google.com/travel/flights");
    expect(google).toContain("ICN");
    expect(google).toContain("NRT");

    const naver = buildNaverFlightsUrl({
      origin: "ICN",
      destination: "NRT",
      departDate: "2026-12-01",
      returnDate: "2026-12-04",
      adults: 2,
    });
    expect(naver).toContain("flight.naver.com");
    expect(naver).toContain("ICN-NRT-20261201");
    expect(naver).toContain("adult=2");

    const agodaFlight = buildAgodaFlightSearchUrl({
      departureFrom: "ICN",
      arrivalTo: "NRT",
      departDate: "2026-12-01",
      returnDate: "2026-12-04",
      adults: 2,
    });
    expect(agodaFlight).toContain("site_id=1922887");

    const agodaHotel = buildAgodaHotelSearchUrl({
      cityId: 5085,
      checkIn: "2026-12-01",
      checkOut: "2026-12-04",
      los: 3,
      adults: 2,
    });
    expect(agodaHotel).toContain("cid=1922887");
  });

  it("local airport search finds major codes", () => {
    for (const code of ["ICN", "NRT", "KIX", "BKK"]) {
      const hits = searchAirportPlaces(code, 10);
      expect(hits.some((p) => p.code === code)).toBe(true);
    }
  });

  it("plan quotes are estimate-only and never fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const flight = await fetchPlanFlightQuote(plan);
    const hotel = await fetchPlanHotelQuote(plan);
    expect(flight?.source).toBe("estimate");
    expect(hotel.source).toBe("estimate");
    expect(fetchMock).toHaveBeenCalledTimes(0);
    vi.unstubAllGlobals();
  });
});
