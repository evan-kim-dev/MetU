/** 국내 도시 토큰 — hotels/destinations · budgetBands 등을 모아 확장 가능 */
export const KR_CITIES = [
  "서울",
  "부산",
  "제주",
  "제주도",
  "강릉",
  "전주",
  "경주",
  "여수",
  "속초",
  "인천",
  "대구",
  "대전",
  "광주",
  "울산",
  "수원",
  "춘천",
  "포항",
  "통영",
  "남해",
  "순천",
  "평창",
  "양양",
  "거제",
  "군산",
  "목포",
  "안동",
  "청주",
  "창원",
  "김해",
  "해운대",
] as const;

export type MapRegion = "KR" | "GLOBAL";

const KR_COUNTRY_ALIASES = new Set([
  "한국",
  "대한민국",
  "korea",
  "southkorea",
  "republicofkorea",
  "kr",
]);

/** 한반도 근사 bbox (위도 33.0~38.7, 경도 124.5~131.9) — 근사값 */
const KR_BBOX = {
  latMin: 33.0,
  latMax: 38.7,
  lngMin: 124.5,
  lngMax: 131.9,
} as const;

function normalizeCountry(country?: string): string {
  return (country ?? "").toLowerCase().replace(/\s+/g, "");
}

function firstDestinationToken(destination?: string): string {
  const raw = (destination ?? "").trim();
  if (!raw) return "";
  return raw.split(/[\s,/·]+/)[0] ?? "";
}

export function regionOf(input: {
  country?: string;
  destination?: string;
  lat?: number;
  lng?: number;
}): MapRegion {
  const countryNorm = normalizeCountry(input.country);
  if (countryNorm && KR_COUNTRY_ALIASES.has(countryNorm)) {
    return "KR";
  }

  const token = firstDestinationToken(input.destination);
  if (token && (KR_CITIES as readonly string[]).includes(token)) {
    return "KR";
  }

  const { lat, lng } = input;
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= KR_BBOX.latMin &&
    lat <= KR_BBOX.latMax &&
    lng >= KR_BBOX.lngMin &&
    lng <= KR_BBOX.lngMax
  ) {
    return "KR";
  }

  return "GLOBAL";
}
