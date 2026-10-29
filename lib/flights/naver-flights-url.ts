/** Naver international flights search deep link. */
export function buildNaverFlightsUrl(params: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults?: number;
}): string {
  const origin = params.origin.toUpperCase();
  const destination = params.destination.toUpperCase();
  const depart = params.departDate.replace(/-/g, "");
  const ret = params.returnDate.replace(/-/g, "");
  const adults = Math.max(1, params.adults ?? 1);
  const path = `international/${origin}-${destination}-${depart}/${destination}-${origin}-${ret}`;
  const url = new URL(`https://flight.naver.com/flights/${path}`);
  url.searchParams.set("adult", String(adults));
  url.searchParams.set("fareType", "Y");
  return url.toString();
}
