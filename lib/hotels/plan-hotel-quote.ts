import type { TripRecommendation } from "@/lib/ai/types";
import { hotelBudgetCap } from "@/lib/ai/realloc-budget";
import { buildAgodaHotelUrlFromPlan } from "@/lib/hotels/agoda-url";

export interface PlanHotelQuote {
  priceKrw: number;
  pricePerNight: number;
  name: string;
  area: string;
  nightsLabel: string;
  agodaUrl: string;
  source: "live" | "estimate" | "city-estimate";
  /** live일 때 총예산 밴드(40%) 이내 여부 */
  withinBand?: boolean;
  budgetCap?: number;
}

function buildEstimateQuote(plan: TripRecommendation): PlanHotelQuote {
  // Agoda city id 없으면 Google 호텔 검색 URL로 폴백 (buildAgodaHotelUrlFromPlan)
  const agodaUrl = buildAgodaHotelUrlFromPlan(plan) ?? "";
  return {
    priceKrw: plan.hotel.total,
    pricePerNight: plan.hotel.pricePerNight,
    name: plan.hotel.name,
    area: plan.hotel.area,
    nightsLabel: `${plan.hotel.nights}박 · 1박 ${plan.hotel.pricePerNight.toLocaleString("ko-KR")}원`,
    agodaUrl,
    source: "estimate",
    budgetCap: hotelBudgetCap(plan.totalBudget),
  };
}

/** Estimate-only quote (live hotel search removed in P1-A). */
export async function fetchPlanHotelQuote(
  plan: TripRecommendation
): Promise<PlanHotelQuote> {
  return buildEstimateQuote(plan);
}
