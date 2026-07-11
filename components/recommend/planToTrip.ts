import { DEFAULTS } from "@/lib/constants";
import type { TripRecommendation } from "@/lib/ai/types";
import type { Trip } from "@/lib/trips/types";

export function planToTrip(
  plan: TripRecommendation,
  flightPrice: number,
  flightAirline: string,
  hotelPrice: number,
  hotelName: string
): Trip {
  const expenses = [
    {
      id: "exp-flight",
      category: "교통",
      label: `${flightAirline} 항공권`,
      amount: flightPrice,
      date: "예약 예정",
    },
    {
      id: "exp-hotel",
      category: "숙소",
      label: `${hotelName} ${plan.hotel.nights}박`,
      amount: hotelPrice,
      date: "예약 예정",
    },
  ];

  return {
    id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    destination: plan.destination,
    country: plan.country,
    origin: plan.origin,
    dateRange: plan.dateRange,
    dDay: DEFAULTS.dDayPlaceholder,
    budget: plan.totalBudget,
    spent: flightPrice + hotelPrice,
    people: plan.people,
    styles: plan.form.styles,
    imageUrl: plan.imageUrl,
    memo: plan.summary,
    status: "upcoming",
    expenses,
    budgetAllocation: plan.budgetAllocation,
    dailySchedule: plan.dailySchedule,
    tips: plan.tips,
  };
}
