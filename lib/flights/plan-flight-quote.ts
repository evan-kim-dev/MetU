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
import { resolveLiveKrwRate } from "@/lib/fx/server";
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

async function estimatePriceKrw(raw: number): Promise<number> {
  const rounded = normalizePriceToKrw(raw);
  // AI가 소액(대개 USD)으로 준 경우만 라이브 USD→KRW 적용. 이미 KRW면 그대로.
  if (rounded > 0 && rounded < 10_000) {
    try {
      const rate = await resolveLiveKrwRate("USD");
      if (rate && rate.krw > 0) {
        return Math.round(rounded * rate.krw);
      }
    } catch {
      /* fall through */
    }
  }
  return rounded;
}

/** Estimate-only quote (live flight search removed in P1-A). */
export async function fetchPlanFlightQuote(
  plan: TripRecommendation
): Promise<PlanFlightQuote | null> {
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

  const priceKrw = await estimatePriceKrw(plan.flight.price);
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
