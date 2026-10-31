import type { TripRecommendation } from "@/lib/ai/types";
import { flightBudgetCap } from "@/lib/ai/realloc-budget";
import {
  resolveIataCode,
  resolveTripFlightDates,
} from "@/lib/flights/agoda-url";
import {
  buildGoogleFlightsSearchUrl,
  buildGoogleFlightsUrlFromPlan,
} from "@/lib/flights/google-flights-url";
import { normalizePriceToKrw } from "@/lib/shared/format";

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

function buildEstimateQuote(plan: TripRecommendation): PlanFlightQuote | null {
  const originCode = resolveIataCode(plan.form.origin || plan.origin);
  const destCode = resolveIataCode(plan.form.destination || plan.destination);
  if (!originCode || !destCode) return null;

  const { departDate, returnDate } = resolveTripFlightDates(
    plan.form,
    plan.nights
  );
  const googleFlightsUrl =
    buildGoogleFlightsUrlFromPlan(plan) ??
    buildGoogleFlightsSearchUrl({
      origin: originCode,
      destination: destCode,
      departDate,
      returnDate,
      adults: plan.people,
    });

  // 클라이언트 번들에서 server-only FX 를 끌어오지 않는다.
  // 계획 금액은 KRW 정수로 취급(×1500 휴리스틱 제거).
  const priceKrw = normalizePriceToKrw(plan.flight.price);
  return {
    priceKrw,
    priceLabel: priceKrw.toLocaleString("ko-KR"),
    airline: plan.flight.airline,
    route: plan.flight.route,
    schedule: plan.flight.schedule,
    googleFlightsUrl,
    source: "estimate",
    budgetCap: flightBudgetCap(plan.totalBudget),
  };
}

/** Estimate-only quote (live flight search removed in P1-A). */
export async function fetchPlanFlightQuote(
  plan: TripRecommendation
): Promise<PlanFlightQuote | null> {
  return buildEstimateQuote(plan);
}
