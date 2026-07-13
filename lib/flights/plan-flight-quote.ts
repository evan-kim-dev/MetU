import type { TripRecommendation } from "@/lib/ai/types";
import {
  flightBudgetCap,
  pickCheapestInBand,
} from "@/lib/ai/realloc-budget";
import {
  resolveIataCode,
  resolveTripFlightDates,
} from "@/lib/flights/agoda-url";
import {
  buildGoogleFlightsSearchUrl,
  buildGoogleFlightsUrlFromPlan,
} from "@/lib/flights/google-flights-url";

export interface PlanFlightQuote {
  priceKrw: number;
  priceLabel: string;
  airline: string;
  route: string;
  schedule: string;
  /** Google Flights 검색 링크 */
  googleFlightsUrl: string;
  source: "live" | "estimate";
  /** live일 때 총예산 밴드(45%) 이내 여부 */
  withinBand?: boolean;
  budgetCap?: number;
}

type FlightSearchItem = {
  price: string;
  carrier: string;
  outbound: string;
  inbound: string;
  route: string;
  bookingUrl?: string;
};

function parsePriceKrw(value: string): number {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function extractTimeLabel(datetime: string): string {
  const match = datetime.match(/(\d{1,2}:\d{2})/);
  return match?.[1] ?? datetime;
}

function formatSchedule(outbound: string, inbound: string): string {
  return `가는 편 ${extractTimeLabel(outbound)} · 오는 편 ${extractTimeLabel(inbound)}`;
}

function buildEstimateQuote(plan: TripRecommendation): PlanFlightQuote | null {
  const originCode = resolveIataCode(plan.form.origin || plan.origin);
  const destCode = resolveIataCode(plan.form.destination || plan.destination);
  if (!originCode || !destCode) return null;

  const { departDate, returnDate } = resolveTripFlightDates(plan.form, plan.nights);
  const googleFlightsUrl =
    buildGoogleFlightsUrlFromPlan(plan) ??
    buildGoogleFlightsSearchUrl({
      origin: originCode,
      destination: destCode,
      departDate,
      returnDate,
      adults: plan.people,
    });

  return {
    priceKrw: plan.flight.price,
    priceLabel: plan.flight.price.toLocaleString("ko-KR"),
    airline: plan.flight.airline,
    route: plan.flight.route,
    schedule: plan.flight.schedule,
    googleFlightsUrl,
    source: "estimate",
    budgetCap: flightBudgetCap(plan.totalBudget),
  };
}

/** Google Flights 실시간 최저가. 실패 시에만 예산 배분 예상가. */
export async function fetchPlanFlightQuote(
  plan: TripRecommendation
): Promise<PlanFlightQuote | null> {
  const estimate = buildEstimateQuote(plan);
  if (!estimate) return null;

  const originCode = resolveIataCode(plan.form.origin || plan.origin);
  const destCode = resolveIataCode(plan.form.destination || plan.destination);
  if (!originCode || !destCode) return estimate;

  const { departDate, returnDate } = resolveTripFlightDates(plan.form, plan.nights);
  const cap = flightBudgetCap(plan.totalBudget);
  const qs = new URLSearchParams({
    origin: originCode,
    destination: destCode,
    departDate,
    returnDate,
    adults: String(plan.people),
    cabinClass: "economy",
    sortBy: "price",
  });

  try {
    const res = await fetch(`/api/flights/search?${qs.toString()}`);
    if (!res.ok) return estimate;

    const data = (await res.json()) as {
      flights?: FlightSearchItem[];
      bookingUrl?: string;
    };
    const flights = data.flights ?? [];

    const picked = pickCheapestInBand(
      flights,
      (f) => parsePriceKrw(f.price),
      Number.POSITIVE_INFINITY
    );
    if (!picked) return estimate;

    const googleFlightsUrl =
      data.bookingUrl ||
      picked.item.bookingUrl ||
      estimate.googleFlightsUrl;

    return {
      priceKrw: picked.price,
      priceLabel: picked.item.price,
      airline: picked.item.carrier,
      route: picked.item.route,
      schedule: formatSchedule(picked.item.outbound, picked.item.inbound),
      googleFlightsUrl,
      source: "live",
      withinBand: picked.price <= cap,
      budgetCap: cap,
    };
  } catch {
    return estimate;
  }
}
