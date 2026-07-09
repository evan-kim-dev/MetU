export type FlightLike = {
  price: string;
  carrier: string;
  outbound: string;
  inbound: string;
  duration: string;
  stops: string;
};

const INVALID_TEXT = new Set([
  "",
  "-",
  "unknown",
  "항공사 정보 없음",
  "n/a",
]);

/** 여객기 검색에서 제외할 화물 항공사 */
const CARGO_CARRIER_KEYWORDS = [
  "fedex",
  "federal express",
  "fedex항공",
  "ups",
  "cargo",
  "freight",
  "cargolux",
  "polar air",
  "airbridge",
  "aerologic",
  "화물",
  "택배",
];

const CARGO_IATA_CODES = new Set([
  "FX",
  "5X",
  "CV",
  "PO",
  "RU",
  "CK",
  "9S",
  "3S",
  "8Y",
]);

function isMeaningfulText(value: string): boolean {
  return !INVALID_TEXT.has(value.trim().toLowerCase());
}

/** Google Flights는 ISO 대신 "8:00 AM on Sat, Aug 8" 형식을 쓴다 */
function isMeaningfulDate(value: string): boolean {
  if (!isMeaningfulText(value)) return false;

  const trimmed = value.trim();
  if (!Number.isNaN(new Date(trimmed).getTime())) return true;

  return (
    /\d{1,2}:\d{2}\s*(AM|PM)/i.test(trimmed) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(trimmed) ||
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(trimmed) ||
    /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|월|화|수|목|금|토|일)\b/.test(trimmed)
  );
}

export function isCargoCarrier(carrier: string): boolean {
  const trimmed = carrier.trim();
  if (!trimmed) return false;

  const upper = trimmed.toUpperCase();
  if (CARGO_IATA_CODES.has(upper)) return true;

  const codeMatch = trimmed.match(/\(([A-Z]{2,3})\)\s*$/);
  if (codeMatch && CARGO_IATA_CODES.has(codeMatch[1])) return true;

  const lowered = trimmed.toLowerCase();
  return CARGO_CARRIER_KEYWORDS.some((keyword) => lowered.includes(keyword));
}

export function isValidFlightItem(flight: FlightLike): boolean {
  if (isCargoCarrier(flight.carrier)) return false;

  return (
    isMeaningfulText(flight.carrier) &&
    isMeaningfulText(flight.price) &&
    isMeaningfulDate(flight.outbound) &&
    isMeaningfulDate(flight.inbound) &&
    isMeaningfulText(flight.duration) &&
    isMeaningfulText(flight.stops)
  );
}

export function filterValidFlights<T extends FlightLike>(flights: T[]): T[] {
  return flights.filter(isValidFlightItem);
}
