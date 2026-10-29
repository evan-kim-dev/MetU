/**
 * Deeplink cards (Google Flights / Naver / Agoda) visibility.
 * Hidden when NEXT_PUBLIC_TRAVEL_LINKS is "false", "0", or "off".
 */
export function travelLinksEnabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_TRAVEL_LINKS ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}
