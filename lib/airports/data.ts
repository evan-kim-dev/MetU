export type PlaceKind = "city" | "airport";

export interface AirportPlace {
  id: string;
  kind: PlaceKind;
  /** 표시용 이름 (예: 서울 (모두), 인천 국제 (ICN)) */
  name: string;
  /** 도시명 */
  city: string;
  /** 국가 */
  country: string;
  /** IATA 코드 (도시 전체면 비움) */
  code?: string;
  /** 도시 그룹 id (공항이면 소속 도시) */
  cityId?: string;
  /** 검색용 키워드 */
  keywords: string[];
}

export const AIRPORT_PLACES: AirportPlace[] = [
  // 서울
  {
    id: "city-sel",
    kind: "city",
    name: "서울 (모두)",
    city: "서울",
    country: "대한민국",
    keywords: ["서울", "seoul", "sel", "korea", "한국"],
  },
  {
    id: "icn",
    kind: "airport",
    name: "인천 국제 (ICN)",
    city: "서울",
    country: "대한민국",
    code: "ICN",
    cityId: "city-sel",
    keywords: ["인천", "incheon", "icn", "서울", "seoul"],
  },
  {
    id: "gmp",
    kind: "airport",
    name: "서울 김포 (GMP)",
    city: "서울",
    country: "대한민국",
    code: "GMP",
    cityId: "city-sel",
    keywords: ["김포", "gimpo", "gmp", "서울", "seoul"],
  },
  // 부산
  {
    id: "city-pus",
    kind: "city",
    name: "부산 (모두)",
    city: "부산",
    country: "대한민국",
    keywords: ["부산", "busan", "pusan", "pus"],
  },
  {
    id: "pus",
    kind: "airport",
    name: "김해 국제 (PUS)",
    city: "부산",
    country: "대한민국",
    code: "PUS",
    cityId: "city-pus",
    keywords: ["김해", "gimhae", "pus", "부산", "busan"],
  },
  // 제주
  {
    id: "city-cju",
    kind: "city",
    name: "제주 (모두)",
    city: "제주",
    country: "대한민국",
    keywords: ["제주", "jeju", "cju"],
  },
  {
    id: "cju",
    kind: "airport",
    name: "제주 국제 (CJU)",
    city: "제주",
    country: "대한민국",
    code: "CJU",
    cityId: "city-cju",
    keywords: ["제주", "jeju", "cju"],
  },
  // 도쿄
  {
    id: "city-tyo",
    kind: "city",
    name: "도쿄 (모두)",
    city: "도쿄",
    country: "일본",
    keywords: ["도쿄", "tokyo", "tyo", "일본", "japan"],
  },
  {
    id: "hnd",
    kind: "airport",
    name: "도쿄 하네다 (HND)",
    city: "도쿄",
    country: "일본",
    code: "HND",
    cityId: "city-tyo",
    keywords: ["하네다", "haneda", "hnd", "도쿄", "tokyo"],
  },
  {
    id: "nrt",
    kind: "airport",
    name: "도쿄 나리타 (NRT)",
    city: "도쿄",
    country: "일본",
    code: "NRT",
    cityId: "city-tyo",
    keywords: ["나리타", "narita", "nrt", "도쿄", "tokyo"],
  },
  // 오사카
  {
    id: "city-osa",
    kind: "city",
    name: "오사카 (모두)",
    city: "오사카",
    country: "일본",
    keywords: ["오사카", "osaka", "osa", "일본", "japan"],
  },
  {
    id: "kix",
    kind: "airport",
    name: "간사이 국제 (KIX)",
    city: "오사카",
    country: "일본",
    code: "KIX",
    cityId: "city-osa",
    keywords: ["간사이", "kansai", "kix", "오사카", "osaka"],
  },
  {
    id: "itm",
    kind: "airport",
    name: "이타미 (ITM)",
    city: "오사카",
    country: "일본",
    code: "ITM",
    cityId: "city-osa",
    keywords: ["이타미", "itami", "itm", "오사카", "osaka"],
  },
  // 방콕
  {
    id: "city-bkk",
    kind: "city",
    name: "방콕 (모두)",
    city: "방콕",
    country: "태국",
    keywords: ["방콕", "bangkok", "bkk", "태국", "thailand"],
  },
  {
    id: "bkk",
    kind: "airport",
    name: "수완나품 (BKK)",
    city: "방콕",
    country: "태국",
    code: "BKK",
    cityId: "city-bkk",
    keywords: ["수완나품", "suvarnabhumi", "bkk", "방콕", "bangkok"],
  },
  {
    id: "dmk",
    kind: "airport",
    name: "돈므앙 (DMK)",
    city: "방콕",
    country: "태국",
    code: "DMK",
    cityId: "city-bkk",
    keywords: ["돈므앙", "don mueang", "dmk", "방콕", "bangkok"],
  },
  // 다낭
  {
    id: "city-dad",
    kind: "city",
    name: "다낭 (모두)",
    city: "다낭",
    country: "베트남",
    keywords: ["다낭", "danang", "da nang", "dad", "베트남", "vietnam"],
  },
  {
    id: "dad",
    kind: "airport",
    name: "다낭 국제 (DAD)",
    city: "다낭",
    country: "베트남",
    code: "DAD",
    cityId: "city-dad",
    keywords: ["다낭", "danang", "dad"],
  },
  // 파리
  {
    id: "city-par",
    kind: "city",
    name: "파리 (모두)",
    city: "파리",
    country: "프랑스",
    keywords: ["파리", "paris", "par", "프랑스", "france"],
  },
  {
    id: "cdg",
    kind: "airport",
    name: "샤를 드 골 (CDG)",
    city: "파리",
    country: "프랑스",
    code: "CDG",
    cityId: "city-par",
    keywords: ["샤를드골", "charles de gaulle", "cdg", "파리", "paris"],
  },
  {
    id: "ory",
    kind: "airport",
    name: "오를리 (ORY)",
    city: "파리",
    country: "프랑스",
    code: "ORY",
    cityId: "city-par",
    keywords: ["오를리", "orly", "ory", "파리", "paris"],
  },
  // 런던
  {
    id: "city-lon",
    kind: "city",
    name: "런던 (모두)",
    city: "런던",
    country: "영국",
    keywords: ["런던", "london", "lon", "영국", "uk", "england"],
  },
  {
    id: "lhr",
    kind: "airport",
    name: "히드로 (LHR)",
    city: "런던",
    country: "영국",
    code: "LHR",
    cityId: "city-lon",
    keywords: ["히드로", "heathrow", "lhr", "런던", "london"],
  },
  {
    id: "lgw",
    kind: "airport",
    name: "개트윅 (LGW)",
    city: "런던",
    country: "영국",
    code: "LGW",
    cityId: "city-lon",
    keywords: ["개트윅", "gatwick", "lgw", "런던", "london"],
  },
  {
    id: "stn",
    kind: "airport",
    name: "스탠스테드 (STN)",
    city: "런던",
    country: "영국",
    code: "STN",
    cityId: "city-lon",
    keywords: ["스탠스테드", "stansted", "stn", "런던", "london"],
  },
  // 뉴욕
  {
    id: "city-nyc",
    kind: "city",
    name: "뉴욕 (모두)",
    city: "뉴욕",
    country: "미국",
    keywords: ["뉴욕", "new york", "nyc", "미국", "usa"],
  },
  {
    id: "jfk",
    kind: "airport",
    name: "존 F. 케네디 (JFK)",
    city: "뉴욕",
    country: "미국",
    code: "JFK",
    cityId: "city-nyc",
    keywords: ["케네디", "jfk", "뉴욕", "new york"],
  },
  {
    id: "ewr",
    kind: "airport",
    name: "뉴어크 리버티 (EWR)",
    city: "뉴욕",
    country: "미국",
    code: "EWR",
    cityId: "city-nyc",
    keywords: ["뉴어크", "newark", "ewr", "뉴욕"],
  },
  {
    id: "lga",
    kind: "airport",
    name: "라과디아 (LGA)",
    city: "뉴욕",
    country: "미국",
    code: "LGA",
    cityId: "city-nyc",
    keywords: ["라과디아", "laguardia", "lga", "뉴욕"],
  },
  // 몬트리올 (참고 이미지와 동일)
  {
    id: "city-ymq",
    kind: "city",
    name: "몬트리올 (모두)",
    city: "몬트리올",
    country: "캐나다",
    keywords: ["몬트리올", "montreal", "ymq", "캐나다", "canada"],
  },
  {
    id: "yul",
    kind: "airport",
    name: "몬트리올 피에르 엘리엇 트루도 (YUL)",
    city: "몬트리올",
    country: "캐나다",
    code: "YUL",
    cityId: "city-ymq",
    keywords: ["트루도", "trudeau", "yul", "몬트리올", "montreal"],
  },
  {
    id: "yhu",
    kind: "airport",
    name: "몬트리올 생위베르 (YHU)",
    city: "몬트리올",
    country: "캐나다",
    code: "YHU",
    cityId: "city-ymq",
    keywords: ["생위베르", "saint-hubert", "yhu", "몬트리올", "montreal"],
  },
  // 싱가포르
  {
    id: "city-sin",
    kind: "city",
    name: "싱가포르 (모두)",
    city: "싱가포르",
    country: "싱가포르",
    keywords: ["싱가포르", "singapore", "sin"],
  },
  {
    id: "sin",
    kind: "airport",
    name: "창이 (SIN)",
    city: "싱가포르",
    country: "싱가포르",
    code: "SIN",
    cityId: "city-sin",
    keywords: ["창이", "changi", "sin", "싱가포르", "singapore"],
  },
  // 홍콩
  {
    id: "city-hkg",
    kind: "city",
    name: "홍콩 (모두)",
    city: "홍콩",
    country: "홍콩",
    keywords: ["홍콩", "hong kong", "hkg"],
  },
  {
    id: "hkg",
    kind: "airport",
    name: "홍콩 국제 (HKG)",
    city: "홍콩",
    country: "홍콩",
    code: "HKG",
    cityId: "city-hkg",
    keywords: ["홍콩", "hong kong", "hkg"],
  },
  // 타이베이
  {
    id: "city-tpe",
    kind: "city",
    name: "타이베이 (모두)",
    city: "타이베이",
    country: "대만",
    keywords: ["타이베이", "taipei", "tpe", "대만", "taiwan"],
  },
  {
    id: "tpe",
    kind: "airport",
    name: "타오위안 (TPE)",
    city: "타이베이",
    country: "대만",
    code: "TPE",
    cityId: "city-tpe",
    keywords: ["타오위안", "taoyuan", "tpe", "타이베이"],
  },
  {
    id: "tsa",
    kind: "airport",
    name: "타이베이 송산 (TSA)",
    city: "타이베이",
    country: "대만",
    code: "TSA",
    cityId: "city-tpe",
    keywords: ["송산", "songshan", "tsa", "타이베이"],
  },
  // 시드니
  {
    id: "city-syd",
    kind: "city",
    name: "시드니 (모두)",
    city: "시드니",
    country: "호주",
    keywords: ["시드니", "sydney", "syd", "호주", "australia"],
  },
  {
    id: "syd",
    kind: "airport",
    name: "시드니 킹스포드 스미스 (SYD)",
    city: "시드니",
    country: "호주",
    code: "SYD",
    cityId: "city-syd",
    keywords: ["시드니", "sydney", "syd"],
  },
  // 발리
  {
    id: "city-dps",
    kind: "city",
    name: "발리/덴파사르 (모두)",
    city: "발리",
    country: "인도네시아",
    keywords: ["발리", "bali", "덴파사르", "denpasar", "dps"],
  },
  {
    id: "dps",
    kind: "airport",
    name: "응우라ライ (DPS)",
    city: "발리",
    country: "인도네시아",
    code: "DPS",
    cityId: "city-dps",
    keywords: ["응우라라이", "ngurah rai", "dps", "발리", "bali"],
  },
];

/** 공항 입력/표시용 공식 명칭 (예: 인천국제공항(ICN)) */
export const AIRPORT_OFFICIAL_NAMES: Record<string, string> = {
  ICN: "인천국제공항",
  GMP: "김포국제공항",
  PUS: "김해국제공항",
  CJU: "제주국제공항",
  HND: "하네다공항",
  NRT: "나리타국제공항",
  KIX: "간사이국제공항",
  ITM: "오사카국제공항",
  BKK: "수완나품국제공항",
  DMK: "돈므앙국제공항",
  DAD: "다낭국제공항",
  CDG: "샤를드골공항",
  ORY: "오를리공항",
  LHR: "히드로공항",
  LGW: "개트윅공항",
  STN: "스탠스테드공항",
  JFK: "존 F. 케네디국제공항",
  EWR: "뉴어크리버티국제공항",
  LGA: "라과디아공항",
  YUL: "몬트리올트루도공항",
  YHU: "몬트리올생위베르공항",
  SIN: "창이국제공항",
  HKG: "홍콩국제공항",
  TPE: "타오위안국제공항",
  TSA: "송산공항",
  SYD: "킹스포드스미스공항",
  DPS: "응우라라이국제공항",
};

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 검색어로 도시/공항 목록을 찾는다. 도시가 매칭되면 하위 공항도 함께 노출 */
export function searchAirportPlaces(query: string, limit = 12): AirportPlace[] {
  const q = normalize(query);
  if (!q) {
    // 기본: 서울 + 인기 도시
    return AIRPORT_PLACES.filter((p) =>
      ["city-sel", "icn", "gmp", "city-tyo", "hnd", "nrt"].includes(p.id)
    );
  }

  const matched = AIRPORT_PLACES.filter((place) => {
    const hay = [
      place.name,
      place.city,
      place.country,
      place.code ?? "",
      formatAirportInputLabel(place),
      ...(place.code ? [AIRPORT_OFFICIAL_NAMES[place.code] ?? ""] : []),
      ...place.keywords,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  // 도시가 히트하면 그 도시 공항도 뒤에 붙인다
  const result: AirportPlace[] = [];
  const seen = new Set<string>();

  for (const place of matched) {
    if (seen.has(place.id)) continue;
    result.push(place);
    seen.add(place.id);

    if (place.kind === "city") {
      for (const airport of AIRPORT_PLACES) {
        if (airport.cityId === place.id && !seen.has(airport.id)) {
          result.push(airport);
          seen.add(airport.id);
        }
      }
    }
  }

  return result.slice(0, limit);
}

/** 항공권 검색 입력란 표시 (예: 인천국제공항(ICN)) */
export function formatAirportInputLabel(place: AirportPlace): string {
  if (place.kind === "city") {
    return `${place.city}(전체)`;
  }
  if (!place.code) {
    return place.name;
  }
  const official =
    AIRPORT_OFFICIAL_NAMES[place.code] ??
    place.name.replace(/\s*\([A-Z]{3}\)\s*$/, "").replace(/\s+/g, "");
  return `${official}(${place.code})`;
}

export function findAirportPlaceByQuery(query: string): AirportPlace | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const paren = trimmed.match(/\(([A-Za-z]{3})\)\s*$/);
  if (paren) {
    const byCode = AIRPORT_PLACES.find(
      (place) => place.code?.toUpperCase() === paren[1].toUpperCase()
    );
    if (byCode) return byCode;
  }

  const q = normalize(trimmed);
  return (
    AIRPORT_PLACES.find((place) => {
      const hay = [
        place.name,
        place.city,
        place.country,
        place.code ?? "",
        formatAirportInputLabel(place),
        ...(place.code ? [AIRPORT_OFFICIAL_NAMES[place.code] ?? ""] : []),
        ...place.keywords,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q) || q.includes((place.code ?? "").toLowerCase());
    }) ?? null
  );
}

export function formatAirportKeyword(keyword: string): string {
  const place = findAirportPlaceByQuery(keyword);
  return place ? formatAirportInputLabel(place) : keyword;
}

/** 표시 라벨을 place name으로, destination용은 "도시, 국가" 포맷도 지원 */
export function formatPlaceLabel(place: AirportPlace): string {
  if (place.kind === "city") return place.name;
  return place.name;
}

export function formatDestinationForPlan(place: AirportPlace): string {
  return `${place.city}, ${place.country}`;
}
