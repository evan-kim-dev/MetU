import { MOCK_DEALS } from "@/lib/deals/data";
import type { Trip } from "@/lib/trips/types";

export type DocsCountryId =
  | "japan"
  | "thailand"
  | "vietnam"
  | "taiwan"
  | "philippines"
  | "singapore"
  | "malaysia"
  | "indonesia"
  | "china"
  | "hongkong"
  | "cambodia"
  | "uk"
  | "europe"
  | "usa";

const COUNTRY_LABEL_TO_ID: Record<string, DocsCountryId> = {
  일본: "japan",
  japan: "japan",
  태국: "thailand",
  thailand: "thailand",
  베트남: "vietnam",
  vietnam: "vietnam",
  대만: "taiwan",
  taiwan: "taiwan",
  필리핀: "philippines",
  philippines: "philippines",
  싱가포르: "singapore",
  singapore: "singapore",
  말레이시아: "malaysia",
  malaysia: "malaysia",
  인도네시아: "indonesia",
  indonesia: "indonesia",
  중국: "china",
  china: "china",
  홍콩: "hongkong",
  "hong kong": "hongkong",
  캄보디아: "cambodia",
  cambodia: "cambodia",
  영국: "uk",
  uk: "uk",
  "united kingdom": "uk",
  유럽: "europe",
  europe: "europe",
  프랑스: "europe",
  france: "europe",
  독일: "europe",
  germany: "europe",
  이탈리아: "europe",
  italy: "europe",
  스페인: "europe",
  spain: "europe",
  포르투갈: "europe",
  portugal: "europe",
  네덜란드: "europe",
  netherlands: "europe",
  벨기에: "europe",
  belgium: "europe",
  스위스: "europe",
  switzerland: "europe",
  오스트리아: "europe",
  austria: "europe",
  체코: "europe",
  czech: "europe",
  그리스: "europe",
  greece: "europe",
  덴마크: "europe",
  denmark: "europe",
  스웨덴: "europe",
  sweden: "europe",
  노르웨이: "europe",
  norway: "europe",
  핀란드: "europe",
  finland: "europe",
  아일랜드: "europe",
  ireland: "europe",
  헝가리: "europe",
  hungary: "europe",
  폴란드: "europe",
  poland: "europe",
  미국: "usa",
  usa: "usa",
  america: "usa",
  "united states": "usa",
};

const DESTINATION_KEYWORDS: Record<DocsCountryId, string[]> = {
  japan: [
    "도쿄",
    "오사카",
    "후쿠오카",
    "삿포로",
    "교토",
    "나고야",
    "오키나와",
    "홋카이도",
    "tokyo",
    "osaka",
    "fukuoka",
    "sapporo",
    "kyoto",
    "nagoya",
    "okinawa",
  ],
  thailand: ["방콕", "푸켓", "치앙마이", "파타야", "bangkok", "phuket", "chiang mai"],
  vietnam: ["다낭", "호치민", "하노이", "나트랑", "danang", "ho chi minh", "hanoi"],
  taiwan: ["타이베이", "타이중", "가오슝", "taipei", "taichung", "kaohsiung"],
  philippines: ["세부", "마닐라", "보라카이", "cebu", "manila", "boracay"],
  singapore: ["싱가포르", "singapore", "센토사", "sentosa", "마리나베이", "marina bay"],
  malaysia: [
    "쿠알라룸푸르",
    "kuala lumpur",
    "랑카위",
    "langkawi",
    "코타키나발루",
    "kota kinabalu",
    "페낭",
    "penang",
    "말라카",
    "malacca",
  ],
  indonesia: [
    "발리",
    "bali",
    "자카르타",
    "jakarta",
    "롬복",
    "lombok",
    "족자카르타",
    "yogyakarta",
    "수라바야",
    "surabaya",
  ],
  china: [
    "베이징",
    "beijing",
    "상하이",
    "shanghai",
    "청두",
    "chengdu",
    "광저우",
    "guangzhou",
    "칭다오",
    "qingdao",
    "시안",
    "xian",
    "항저우",
    "hangzhou",
    "선전",
    "shenzhen",
  ],
  hongkong: ["홍콩", "hong kong", "홍콩섬", "침사추이", "tsim sha tsui", "몽콕", "mong kok"],
  cambodia: ["캄보디아", "cambodia", "시엠립", "siem reap", "앙코르", "angkor", "프놈펜", "phnom penh"],
  uk: [
    "런던",
    "london",
    "에든버러",
    "edinburgh",
    "맨체스터",
    "manchester",
    "리버풀",
    "liverpool",
    "옥스퍼드",
    "oxford",
    "캠브리지",
    "cambridge",
    "글래스고",
    "glasgow",
    "버밍엄",
    "birmingham",
  ],
  europe: [
    "파리",
    "paris",
    "로마",
    "rome",
    "밀라노",
    "milan",
    "바르셀로나",
    "barcelona",
    "마드리드",
    "madrid",
    "암스테르담",
    "amsterdam",
    "베를린",
    "berlin",
    "프라하",
    "prague",
    "비엔나",
    "vienna",
    "취리히",
    "zurich",
    "리스본",
    "lisbon",
    "부다페스트",
    "budapest",
    "아테네",
    "athens",
    "코펜하겐",
    "copenhagen",
    "스톡홀름",
    "stockholm",
    "오슬로",
    "oslo",
    "더블린",
    "dublin",
    "니스",
    "nice",
    "몬테카를로",
    "monaco",
    "브뤼셀",
    "brussels",
    "뮌헨",
    "munich",
    "피렌체",
    "florence",
    "베니스",
    "venice",
    "인터라켄",
    "interlaken",
  ],
  usa: [
    "뉴욕",
    "new york",
    "로스앤젤레스",
    "los angeles",
    "라스베가스",
    "las vegas",
    "샌프란시스코",
    "san francisco",
    "하와이",
    "hawaii",
    "호놀룰루",
    "honolulu",
    "시애틀",
    "seattle",
    "시카고",
    "chicago",
    "보스턴",
    "boston",
    "마이애미",
    "miami",
    "올랜도",
    "orlando",
    "워싱턴",
    "washington",
    "샌디에이고",
    "san diego",
  ],
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function matchByKeywords(source: string): DocsCountryId | null {
  for (const [countryId, keywords] of Object.entries(DESTINATION_KEYWORDS) as [
    DocsCountryId,
    string[],
  ][]) {
    if (keywords.some((keyword) => source.includes(normalizeText(keyword)))) {
      return countryId;
    }
  }
  return null;
}

function matchByCountryLabel(country: string): DocsCountryId | null {
  const normalized = normalizeText(country);
  const entries = Object.entries(COUNTRY_LABEL_TO_ID).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [label, countryId] of entries) {
    const normalizedLabel = normalizeText(label);
    if (label.length <= 3) {
      if (normalized === normalizedLabel) return countryId;
      continue;
    }
    if (normalized.includes(normalizedLabel)) {
      return countryId;
    }
  }
  return null;
}

function matchByDealDestination(destination: string): DocsCountryId | null {
  const primary = destination.split(/[,，·/]/)[0]?.trim() ?? destination.trim();
  if (!primary) return null;

  const deal = MOCK_DEALS.find(
    (item) =>
      primary.includes(item.name) ||
      item.name.includes(primary) ||
      normalizeText(primary).includes(normalizeText(item.name))
  );
  if (!deal) return null;
  return COUNTRY_LABEL_TO_ID[normalizeText(deal.country)] ?? null;
}

/** 메인 홈 `진행 중인 여행`과 동일하게 첫 번째 활성 여행을 사용한다. */
export function getPrimaryActiveTrip(trips: Trip[]): Trip | null {
  return trips[0] ?? null;
}

export function resolveDocsCountryFromTrip(
  trip: Pick<Trip, "country" | "destination">
): DocsCountryId | null {
  const source = normalizeText(`${trip.country} ${trip.destination}`);

  const byCountry = matchByCountryLabel(trip.country);
  if (byCountry) return byCountry;

  const byDestination = matchByKeywords(source);
  if (byDestination) return byDestination;

  return matchByDealDestination(trip.destination);
}
