import type { TripRecommendation } from "@/lib/ai/types";
import {
  resolveIataCode,
  resolveTripFlightDates,
} from "@/lib/flights/agoda-url";

/**
 * Google Flights 검색 URL (항공 전용 — Agoda 미사용).
 * live 조회 실패 시에도 같은 조건으로 열어볼 수 있게 한다.
 */
export function buildGoogleFlightsSearchUrl(params: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults?: number;
}): string {
  const origin = params.origin.toUpperCase();
  const destination = params.destination.toUpperCase();

  const url = new URL("https://www.google.com/travel/flights");
  url.searchParams.set("hl", "ko");
  url.searchParams.set("gl", "KR");
  url.searchParams.set("curr", "KRW");

  const outbound = `${origin}.${destination}.${params.departDate}`;
  const inbound = params.returnDate
    ? `*${destination}.${origin}.${params.returnDate}`
    : "";
  url.hash = `flt=${outbound}${inbound};c:KRW;e:1;sd:1;t:f;tt:o`;

  return url.toString();
}

export function buildGoogleFlightsUrlFromPlan(
  plan: TripRecommendation
): string | null {
  const originCode = resolveIataCode(plan.form.origin || plan.origin);
  const destCode = resolveIataCode(plan.form.destination || plan.destination);
  if (!originCode || !destCode) return null;

  const { departDate, returnDate } = resolveTripFlightDates(
    plan.form,
    plan.nights
  );

  return buildGoogleFlightsSearchUrl({
    origin: originCode,
    destination: destCode,
    departDate,
    returnDate,
    adults: plan.people,
  });
}
