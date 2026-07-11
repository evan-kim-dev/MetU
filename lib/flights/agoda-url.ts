import type { OnboardingForm } from "@/lib/onboarding/types";
import { normalizeFlexibleYear } from "@/lib/onboarding/types";
import type { TripRecommendation } from "@/lib/ai/types";
import { AIRPORT_PLACES, findAirportPlaceByQuery } from "@/lib/airports/data";
import { addDays } from "@/lib/shared/dates";

const AGODA_FLIGHTS_BASE = "https://www.agoda.com/ko-kr/flights/results";

export type AgodaCabinType =
  | "Economy"
  | "PremiumEconomy"
  | "Business"
  | "First";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 도시·공항 문자열에서 IATA 공항 코드를 추출한다. */
export function resolveIataCode(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const paren = trimmed.match(/\(([A-Za-z]{3})\)/);
  if (paren) return paren[1].toUpperCase();

  const place = findAirportPlaceByQuery(trimmed);
  if (place?.code) return place.code;

  if (place?.kind === "city") {
    const airport = AIRPORT_PLACES.find(
      (item) => item.cityId === place.id && item.code
    );
    if (airport?.code) return airport.code;
  }

  const cityPart = trimmed.split(/[,，·]/)[0]?.trim() ?? trimmed;
  const byCity = AIRPORT_PLACES.find(
    (item) =>
      item.kind === "airport" &&
      item.code &&
      (item.city === cityPart ||
        cityPart.includes(item.city) ||
        item.city.includes(cityPart))
  );
  if (byCity?.code) return byCity.code;

  return null;
}

export function resolveTripFlightDates(
  form: OnboardingForm,
  nights: number
): { departDate: string; returnDate: string } {
  if (form.dateType === "specific" && form.startDate) {
    return {
      departDate: form.startDate,
      returnDate: form.endDate || addDays(form.startDate, Math.max(1, nights)),
    };
  }

  const year =
    form.dateType === "flexible"
      ? normalizeFlexibleYear(form.flexibleYear)
      : new Date().getFullYear();
  const month =
    form.dateType === "flexible" &&
    form.flexibleMonth >= 1 &&
    form.flexibleMonth <= 12
      ? form.flexibleMonth
      : new Date().getMonth() + 2;

  const departDate = `${year}-${pad(month)}-12`;
  return {
    departDate,
    returnDate: addDays(departDate, Math.max(1, nights)),
  };
}

function inferCabinType(totalBudget: number): AgodaCabinType {
  if (totalBudget >= 8_000_000) return "Business";
  if (totalBudget >= 4_000_000) return "PremiumEconomy";
  return "Economy";
}

export function buildAgodaFlightSearchUrl(params: {
  departureFrom: string;
  arrivalTo: string;
  departDate: string;
  returnDate: string;
  adults: number;
  cabinType?: AgodaCabinType;
}): string {
  const url = new URL(AGODA_FLIGHTS_BASE);
  url.searchParams.set("site_id", "1922887");
  url.searchParams.set("searchType", "1");
  url.searchParams.set("departureFrom", params.departureFrom.toUpperCase());
  url.searchParams.set("departureFromType", "1");
  url.searchParams.set("arrivalTo", params.arrivalTo.toUpperCase());
  url.searchParams.set("arrivalToType", "1");
  url.searchParams.set("departDate", params.departDate);
  url.searchParams.set("returnDate", params.returnDate);
  url.searchParams.set("adults", String(Math.max(1, params.adults)));
  url.searchParams.set("cabinType", params.cabinType ?? "Economy");
  url.searchParams.set("sort", "8");
  return url.toString();
}

/** AI 추천 결과를 Agoda 항공권 검색 URL로 변환한다. */
export function buildAgodaUrlFromPlan(plan: TripRecommendation): string | null {
  const originCode = resolveIataCode(plan.form.origin || plan.origin);
  const destCode = resolveIataCode(plan.form.destination || plan.destination);
  if (!originCode || !destCode) return null;

  const { departDate, returnDate } = resolveTripFlightDates(
    plan.form,
    plan.nights
  );

  return buildAgodaFlightSearchUrl({
    departureFrom: originCode,
    arrivalTo: destCode,
    departDate,
    returnDate,
    adults: plan.people,
    cabinType: inferCabinType(plan.totalBudget),
  });
}
