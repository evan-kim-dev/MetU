import type { TripRecommendation } from "@/lib/ai/types";
import { buildAgodaHotelUrlFromPlan, resolveHotelStayDates } from "@/lib/hotels/agoda-url";

export interface PlanHotelQuote {
  priceKrw: number;
  pricePerNight: number;
  name: string;
  area: string;
  nightsLabel: string;
  agodaUrl: string;
  source: "live" | "estimate";
}

type HotelSearchItem = {
  name: string;
  area: string;
  price: string;
};

function parsePriceKrw(value: string): number {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function buildEstimateQuote(plan: TripRecommendation): PlanHotelQuote | null {
  const agodaUrl = buildAgodaHotelUrlFromPlan(plan);
  if (!agodaUrl) return null;

  return {
    priceKrw: plan.hotel.total,
    pricePerNight: plan.hotel.pricePerNight,
    name: plan.hotel.name,
    area: plan.hotel.area,
    nightsLabel: `${plan.hotel.nights}박 · 1박 ${plan.hotel.pricePerNight.toLocaleString("ko-KR")}원`,
    agodaUrl,
    source: "estimate",
  };
}

function pickBestHotel(
  hotels: HotelSearchItem[],
  targetPrice: number
): HotelSearchItem | null {
  if (hotels.length === 0) return null;

  return hotels.reduce<HotelSearchItem>((best, hotel) => {
    const price = parsePriceKrw(hotel.price);
    const bestPrice = parsePriceKrw(best.price);
    const priceGap = Math.abs(price - targetPrice);
    const bestGap = Math.abs(bestPrice - targetPrice);
    if (priceGap < bestGap) return hotel;
    if (priceGap === bestGap && price < bestPrice) return hotel;
    return best;
  }, hotels[0]);
}

/** AI 추천 일정 기준 실시간 숙소 최저가를 조회한다. */
export async function fetchPlanHotelQuote(
  plan: TripRecommendation
): Promise<PlanHotelQuote | null> {
  const estimate = buildEstimateQuote(plan);
  if (!estimate) return null;

  const destination = plan.destination || plan.form.destination;
  const nights = plan.hotel.nights || plan.nights;
  const { checkIn, checkOut } = resolveHotelStayDates(plan.form, nights);
  const rooms = plan.people <= 2 ? 1 : Math.min(4, Math.ceil(plan.people / 2));

  const qs = new URLSearchParams({
    destination,
    checkIn,
    checkOut,
    adults: String(plan.people),
    rooms: String(rooms),
    children: "0",
    sortBy: "price",
  });

  try {
    const res = await fetch(`/api/hotels/search?${qs.toString()}`);
    if (!res.ok) return estimate;

    const data = (await res.json()) as { hotels?: HotelSearchItem[] };
    const hotels = data.hotels ?? [];
    const best = pickBestHotel(hotels, plan.hotel.total);
    if (!best) return estimate;

    const priceKrw = parsePriceKrw(best.price);
    if (priceKrw <= 0) return estimate;

    const pricePerNight = Math.round(priceKrw / Math.max(1, nights));

    return {
      priceKrw,
      pricePerNight,
      name: best.name,
      area: best.area || plan.hotel.area,
      nightsLabel: `${nights}박 · 1박 ${pricePerNight.toLocaleString("ko-KR")}원`,
      agodaUrl: estimate.agodaUrl,
      source: "live",
    };
  } catch {
    return estimate;
  }
}
