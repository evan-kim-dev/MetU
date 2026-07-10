import type { TripRecommendation } from "@/lib/ai/types";
import {
  buildAgodaFlightSearchUrl,
  resolveIataCode,
  resolveTripFlightDates,
} from "@/lib/flights/agoda-url";

export interface PlanFlightQuote {
  priceKrw: number;
  priceLabel: string;
  airline: string;
  route: string;
  schedule: string;
  agodaUrl: string;
  source: "live" | "estimate";
}

type FlightSearchItem = {
  price: string;
  carrier: string;
  outbound: string;
  inbound: string;
  route: string;
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

function inferCabinType(totalBudget: number): "Economy" | "PremiumEconomy" | "Business" | "First" {
  if (totalBudget >= 8_000_000) return "Business";
  if (totalBudget >= 4_000_000) return "PremiumEconomy";
  return "Economy";
}

function buildEstimateQuote(plan: TripRecommendation): PlanFlightQuote | null {
  const originCode = resolveIataCode(plan.form.origin || plan.origin);
  const destCode = resolveIataCode(plan.form.destination || plan.destination);
  if (!originCode || !destCode) return null;

  const { departDate, returnDate } = resolveTripFlightDates(plan.form, plan.nights);
  const agodaUrl = buildAgodaFlightSearchUrl({
    departureFrom: originCode,
    arrivalTo: destCode,
    departDate,
    returnDate,
    adults: plan.people,
    cabinType: inferCabinType(plan.totalBudget),
  });

  return {
    priceKrw: plan.flight.price,
    priceLabel: plan.flight.price.toLocaleString("ko-KR"),
    airline: plan.flight.airline,
    route: plan.flight.route,
    schedule: plan.flight.schedule,
    agodaUrl,
    source: "estimate",
  };
}

function pickBestFlight(
  flights: FlightSearchItem[],
  targetPrice: number
): FlightSearchItem | null {
  if (flights.length === 0) return null;

  return flights.reduce<FlightSearchItem>((best, flight) => {
    const price = parsePriceKrw(flight.price);
    const bestPrice = parsePriceKrw(best.price);
    const priceGap = Math.abs(price - targetPrice);
    const bestGap = Math.abs(bestPrice - targetPrice);
    if (priceGap < bestGap) return flight;
    if (priceGap === bestGap && price < bestPrice) return flight;
    return best;
  }, flights[0]);
}

/** AI 추천 일정 기준 실시간 항공 최저가를 조회한다. */
export async function fetchPlanFlightQuote(
  plan: TripRecommendation
): Promise<PlanFlightQuote | null> {
  const estimate = buildEstimateQuote(plan);
  if (!estimate) return null;

  const originCode = resolveIataCode(plan.form.origin || plan.origin);
  const destCode = resolveIataCode(plan.form.destination || plan.destination);
  if (!originCode || !destCode) return estimate;

  const { departDate, returnDate } = resolveTripFlightDates(plan.form, plan.nights);
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

    const data = (await res.json()) as { flights?: FlightSearchItem[] };
    const flights = data.flights ?? [];
    const best = pickBestFlight(flights, plan.flight.price);
    if (!best) return estimate;

    const priceKrw = parsePriceKrw(best.price);
    if (priceKrw <= 0) return estimate;

    return {
      priceKrw,
      priceLabel: best.price,
      airline: best.carrier,
      route: best.route,
      schedule: formatSchedule(best.outbound, best.inbound),
      agodaUrl: estimate.agodaUrl,
      source: "live",
    };
  } catch {
    return estimate;
  }
}
