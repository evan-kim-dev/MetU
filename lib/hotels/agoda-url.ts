import type { OnboardingForm } from "@/components/onboarding/types";
import type { TripRecommendation } from "@/lib/ai/types";
import { resolveTripFlightDates } from "@/lib/flights/agoda-url";
import { resolveAgodaCityId } from "@/lib/hotels/agoda-cities";

const AGODA_HOTEL_BASE = "https://www.agoda.com/ko-kr/search";
const AGODA_CID = "1922887";
const AGODA_TAG = "f7739694-dbb7-41bd-aa27-be7c942ce354";

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveHotelStayDates(
  form: OnboardingForm,
  nights: number
): { checkIn: string; checkOut: string; los: number } {
  const { departDate } = resolveTripFlightDates(form, nights);
  const los = Math.max(1, nights);
  return {
    checkIn: departDate,
    checkOut: addDays(departDate, los),
    los,
  };
}

function resolveRooms(adults: number): number {
  if (adults <= 2) return 1;
  return Math.min(4, Math.ceil(adults / 2));
}

export function buildAgodaHotelSearchUrl(params: {
  cityId: number;
  checkIn: string;
  checkOut: string;
  los: number;
  adults: number;
  rooms?: number;
}): string {
  const url = new URL(AGODA_HOTEL_BASE);
  url.searchParams.set("city", String(params.cityId));
  url.searchParams.set("checkIn", params.checkIn);
  url.searchParams.set("checkOut", params.checkOut);
  url.searchParams.set("los", String(params.los));
  url.searchParams.set("rooms", String(params.rooms ?? resolveRooms(params.adults)));
  url.searchParams.set("adults", String(Math.max(1, params.adults)));
  url.searchParams.set("children", "0");
  url.searchParams.set("cid", AGODA_CID);
  url.searchParams.set("currency", "KRW");
  url.searchParams.set("locale", "ko-kr");
  url.searchParams.set("tag", AGODA_TAG);
  return url.toString();
}

/** AI 추천 결과를 Agoda 숙소 검색 URL로 변환한다. */
export function buildAgodaHotelUrlFromPlan(
  plan: TripRecommendation
): string | null {
  const destination =
    plan.destination || plan.form.destination || plan.hotel.area;
  const cityId = resolveAgodaCityId(destination);
  if (!cityId) return null;

  const nights = plan.hotel.nights || plan.nights;
  const { checkIn, checkOut, los } = resolveHotelStayDates(plan.form, nights);

  return buildAgodaHotelSearchUrl({
    cityId,
    checkIn,
    checkOut,
    los,
    adults: plan.people,
  });
}
