"use client";

import { useEffect, useState } from "react";
import type { TripRecommendation } from "@/lib/ai/types";
import {
  fetchPlanFlightQuote,
  type PlanFlightQuote,
} from "@/lib/flights/plan-flight-quote";
import {
  fetchPlanHotelQuote,
  type PlanHotelQuote,
} from "@/lib/hotels/plan-hotel-quote";

export function usePlanQuotes(plan: TripRecommendation) {
  const [flightQuote, setFlightQuote] = useState<PlanFlightQuote | null>(null);
  const [hotelQuote, setHotelQuote] = useState<PlanHotelQuote | null>(null);
  const [flightQuoteLoading, setFlightQuoteLoading] = useState(true);
  const [hotelQuoteLoading, setHotelQuoteLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setFlightQuoteLoading(true);
    setHotelQuoteLoading(true);

    void Promise.all([
      fetchPlanFlightQuote(plan),
      fetchPlanHotelQuote(plan),
    ]).then(([flight, hotel]) => {
      if (cancelled) return;
      setFlightQuote(flight);
      setHotelQuote(hotel);
      setFlightQuoteLoading(false);
      setHotelQuoteLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // 목적지·일정이 같으면 AI 보강 후에도 재조회하지 않음
  }, [plan.id, plan.destination, plan.dateRange, plan.origin]);

  return {
    flightQuote,
    hotelQuote,
    flightQuoteLoading,
    hotelQuoteLoading,
  };
}
