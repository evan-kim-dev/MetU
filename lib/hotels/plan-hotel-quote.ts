import type { TripRecommendation } from "@/lib/ai/types";
import {
  hotelBudgetCap,
  pickCheapestInBand,
} from "@/lib/ai/realloc-budget";
import { buildAgodaHotelUrlFromPlan, resolveHotelStayDates } from "@/lib/hotels/agoda-url";

export interface PlanHotelQuote {
  priceKrw: number;
  pricePerNight: number;
  name: string;
  area: string;
  nightsLabel: string;
  agodaUrl: string;
  source: "live" | "estimate";
  /** live일 때 총예산 밴드(40%) 이내 여부 */
  withinBand?: boolean;
  budgetCap?: number;
}

type HotelSearchItem = {
  name: string;
  area: string;
  price: string;
};

function parsePriceKrw(value: string): number {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function buildEstimateQuote(plan: TripRecommendation): PlanHotelQuote {
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

/** AI 추천 일정 기준 실시간 숙소 — 예산 밴드 안 최저가 우선. */
export async function fetchPlanHotelQuote(
  plan: TripRecommendation
): Promise<PlanHotelQuote> {
  const estimate = buildEstimateQuote(plan);

  const destination = plan.destination || plan.form.destination;
  const nights = plan.hotel.nights || plan.nights;
  const { checkIn, checkOut } = resolveHotelStayDates(plan.form, nights);
  const rooms = plan.people <= 2 ? 1 : Math.min(4, Math.ceil(plan.people / 2));
  const cap = hotelBudgetCap(plan.totalBudget);

  const qs = new URLSearchParams({
    destination,
    checkIn,
    checkOut,
    adults: String(plan.people),
    rooms: String(rooms),
    children: "0",
    sortBy: "best",
  });

  try {
    const res = await fetch(`/api/hotels/search?${qs.toString()}`);
    if (!res.ok) return estimate;

    const data = (await res.json()) as { hotels?: HotelSearchItem[] };
    const hotels = data.hotels ?? [];
    const picked = pickCheapestInBand(hotels, (h) => parsePriceKrw(h.price), cap);
    if (!picked) return estimate;

    const pricePerNight = Math.round(picked.price / Math.max(1, nights));

    return {
      priceKrw: picked.price,
      pricePerNight,
      name: picked.item.name,
      area: picked.item.area || plan.hotel.area,
      nightsLabel: `${nights}박 · 1박 ${pricePerNight.toLocaleString("ko-KR")}원`,
      agodaUrl: estimate.agodaUrl,
      source: "live",
      withinBand: picked.withinBand,
      budgetCap: cap,
    };
  } catch {
    return estimate;
  }
}
