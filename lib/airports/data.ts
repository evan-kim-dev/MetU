export type PlaceKind = "city" | "airport" | "country";

export type ContinentId =
  | "east-asia"
  | "southeast-asia"
  | "europe"
  | "americas"
  | "oceania"
  | "middle-east"
  | "other";

export interface AirportPlace {
  id: string;
  kind: PlaceKind;
  /** 표시용 이름 (예: 서울 (모두), 인천 국제 (ICN), 일본 (전체)) */
  name: string;
  /** 도시명 (나라 항목이면 빈 문자열) */
  city: string;
  /** 국가 */
  country: string;
  /** IATA 코드 (도시·나라면 비움) */
  code?: string;
  /** 도시 그룹 id (공항이면 소속 도시) */
  cityId?: string;
  /** 나라 그룹 id (도시·나라이면 소속 나라) */
  countryId?: string;
  /** 영문/약칭/구 표기 별칭 */
  aliases?: string[];
  /** 검색용 키워드 */
  keywords: string[];
}

export const CONTINENT_LABELS: Record<ContinentId, string> = {
  "east-asia": "동아시아",
  "southeast-asia": "동남아시아",
  europe: "유럽",
  americas: "미주",
  oceania: "오세아니아",
  "middle-east": "중동",
  other: "기타",
};

const CONTINENT_ORDER: ContinentId[] = [
  "east-asia",
  "southeast-asia",
  "europe",
  "americas",
  "oceania",
  "middle-east",
  "other",
];

const COUNTRY_TO_CONTINENT: Record<string, ContinentId> = {
  대한민국: "east-asia",
  일본: "east-asia",
  중국: "east-asia",
  홍콩: "east-asia",
  대만: "east-asia",
  몽골: "east-asia",
  태국: "southeast-asia",
  베트남: "southeast-asia",
  싱가포르: "southeast-asia",
  인도네시아: "southeast-asia",
  필리핀: "southeast-asia",
  말레이시아: "southeast-asia",
  프랑스: "europe",
  영국: "europe",
  이탈리아: "europe",
  스페인: "europe",
  독일: "europe",
  러시아: "other",
  미국: "americas",
  캐나다: "americas",
  호주: "oceania",
  아랍에미리트: "middle-east",
};

export function getContinentId(place: AirportPlace): ContinentId {
  return COUNTRY_TO_CONTINENT[place.country] ?? "other";
}

export function groupPlacesByContinent(
  places: AirportPlace[]
): Array<{ id: ContinentId; label: string; places: AirportPlace[] }> {
  const buckets = new Map<ContinentId, AirportPlace[]>();

  for (const place of places) {
    const id = getContinentId(place);
    const list = buckets.get(id);
    if (list) list.push(place);
    else buckets.set(id, [place]);
  }

  return CONTINENT_ORDER.filter((id) => (buckets.get(id)?.length ?? 0) > 0).map(
    (id) => ({
      id,
      label: CONTINENT_LABELS[id],
      places: buckets.get(id) ?? [],
    })
  );
}

function countryPlace(
  id: string,
  country: string,
  keywords: string[],
  aliases?: string[]
): AirportPlace {
  return {
    id,
    kind: "country",
    name: `${country} (전체)`,
    city: "",
    country,
    countryId: id,
    aliases,
    keywords,
  };
}

export const AIRPORT_PLACES: AirportPlace[] = [
  // —— 나라 ——
  countryPlace("country-kr", "대한민국", [
    "대한민국",
    "한국",
    "korea",
    "south korea",
    "kr",
    "kor",
    "rok",
  ], ["korea", "kr", "kor"]),
  countryPlace("country-jp", "일본", [
    "일본",
    "japan",
    "jp",
    "jpn",
    "니혼",
    "닛폰",
  ], ["japan", "jp", "jpn"]),
  countryPlace("country-cn", "중국", [
    "중국",
    "china",
    "cn",
    "chn",
    "중화인민공화국",
  ], ["china", "cn", "chn"]),
  countryPlace("country-hk", "홍콩", [
    "홍콩",
    "hong kong",
    "hongkong",
    "hk",
    "hkg",
  ], ["hong kong", "hk", "hkg"]),
  countryPlace("country-tw", "대만", [
    "대만",
    "taiwan",
    "tw",
    "twn",
    "타이완",
  ], ["taiwan", "tw", "twn"]),
  countryPlace("country-th", "태국", [
    "태국",
    "thailand",
    "th",
    "tha",
    "타이",
  ], ["thailand", "th", "tha"]),
  countryPlace("country-vn", "베트남", [
    "베트남",
    "vietnam",
    "vn",
    "vnm",
    "베트남사회주의공화국",
  ], ["vietnam", "vn", "vnm"]),
  countryPlace("country-sg", "싱가포르", [
    "싱가포르",
    "singapore",
    "sg",
    "sgp",
  ], ["singapore", "sg", "sgp"]),
  countryPlace("country-id", "인도네시아", [
    "인도네시아",
    "indonesia",
    "id",
    "idn",
  ], ["indonesia", "id", "idn"]),
  countryPlace("country-ph", "필리핀", [
    "필리핀",
    "philippines",
    "ph",
    "phl",
    "필리핀공화국",
  ], ["philippines", "ph", "phl"]),
  countryPlace("country-fr", "프랑스", [
    "프랑스",
    "france",
    "fr",
    "fra",
  ], ["france", "fr", "fra"]),
  countryPlace("country-gb", "영국", [
    "영국",
    "uk",
    "united kingdom",
    "britain",
    "england",
    "gb",
    "gbr",
  ], ["uk", "gb", "gbr", "britain"]),
  countryPlace("country-it", "이탈리아", [
    "이탈리아",
    "italy",
    "it",
    "ita",
  ], ["italy", "it", "ita"]),
  countryPlace("country-es", "스페인", [
    "스페인",
    "spain",
    "es",
    "esp",
  ], ["spain", "es", "esp"]),
  countryPlace("country-de", "독일", [
    "독일",
    "germany",
    "de",
    "deu",
    "deutschland",
  ], ["germany", "de", "deu"]),
  countryPlace("country-us", "미국", [
    "미국",
    "usa",
    "us",
    "america",
    "united states",
    "미합중국",
  ], ["usa", "us", "america"]),
  countryPlace("country-ca", "캐나다", [
    "캐나다",
    "canada",
    "ca",
    "can",
  ], ["canada", "ca", "can"]),
  countryPlace("country-au", "호주", [
    "호주",
    "australia",
    "au",
    "aus",
    "오스트레일리아",
  ], ["australia", "au", "aus"]),
  countryPlace("country-ae", "아랍에미리트", [
    "아랍에미리트",
    "uae",
    "ae",
    "are",
    "아랍에미레이트",
    "emirates",
  ], ["uae", "ae", "are"]),

  // —— 서울 ——
  {
    id: "city-sel",
    kind: "city",
    name: "서울 (모두)",
    city: "서울",
    country: "대한민국",
    countryId: "country-kr",
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
    countryId: "country-kr",
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
    countryId: "country-kr",
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
  // 대구
  {
    id: "city-tae",
    kind: "city",
    name: "대구 (모두)",
    city: "대구",
    country: "대한민국",
    countryId: "country-kr",
    keywords: ["대구", "daegu", "taegu", "tae"],
  },
  {
    id: "tae",
    kind: "airport",
    name: "대구 국제 (TAE)",
    city: "대구",
    country: "대한민국",
    code: "TAE",
    cityId: "city-tae",
    keywords: ["대구", "daegu", "tae"],
  },
  // 청주
  {
    id: "city-cjj",
    kind: "city",
    name: "청주 (모두)",
    city: "청주",
    country: "대한민국",
    countryId: "country-kr",
    keywords: ["청주", "cheongju", "cjj"],
  },
  {
    id: "cjj",
    kind: "airport",
    name: "청주 국제 (CJJ)",
    city: "청주",
    country: "대한민국",
    code: "CJJ",
    cityId: "city-cjj",
    keywords: ["청주", "cheongju", "cjj"],
  },
  // 광주
  {
    id: "city-kwj",
    kind: "city",
    name: "광주 (모두)",
    city: "광주",
    country: "대한민국",
    countryId: "country-kr",
    keywords: ["광주", "gwangju", "kwangju", "kwj"],
  },
  {
    id: "kwj",
    kind: "airport",
    name: "광주 (KWJ)",
    city: "광주",
    country: "대한민국",
    code: "KWJ",
    cityId: "city-kwj",
    keywords: ["광주", "gwangju", "kwj"],
  },
  // 양양
  {
    id: "city-yny",
    kind: "city",
    name: "양양 (모두)",
    city: "양양",
    country: "대한민국",
    countryId: "country-kr",
    keywords: ["양양", "yangyang", "yny"],
  },
  {
    id: "yny",
    kind: "airport",
    name: "양양 국제 (YNY)",
    city: "양양",
    country: "대한민국",
    code: "YNY",
    cityId: "city-yny",
    keywords: ["양양", "yangyang", "yny"],
  },
  // 무안
  {
    id: "city-mwx",
    kind: "city",
    name: "무안 (모두)",
    city: "무안",
    country: "대한민국",
    countryId: "country-kr",
    keywords: ["무안", "muan", "mwx"],
  },
  {
    id: "mwx",
    kind: "airport",
    name: "무안 국제 (MWX)",
    city: "무안",
    country: "대한민국",
    code: "MWX",
    cityId: "city-mwx",
    keywords: ["무안", "muan", "mwx"],
  },
  // 도쿄
  {
    id: "city-tyo",
    kind: "city",
    name: "도쿄 (모두)",
    city: "도쿄",
    country: "일본",
    countryId: "country-jp",
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
    countryId: "country-jp",
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
  // 후쿠오카
  {
    id: "city-fuk",
    kind: "city",
    name: "후쿠오카 (모두)",
    city: "후쿠오카",
    country: "일본",
    countryId: "country-jp",
    keywords: ["후쿠오카", "fukuoka", "fuk", "일본", "japan"],
  },
  {
    id: "fuk",
    kind: "airport",
    name: "후쿠오카 (FUK)",
    city: "후쿠오카",
    country: "일본",
    code: "FUK",
    cityId: "city-fuk",
    keywords: ["후쿠오카", "fukuoka", "fuk"],
  },
  // 삿포로
  {
    id: "city-spk",
    kind: "city",
    name: "삿포로 (모두)",
    city: "삿포로",
    country: "일본",
    countryId: "country-jp",
    keywords: ["삿포로", "sapporo", "spk", "cts", "일본", "japan"],
  },
  {
    id: "cts",
    kind: "airport",
    name: "신치토세 (CTS)",
    city: "삿포로",
    country: "일본",
    code: "CTS",
    cityId: "city-spk",
    keywords: ["신치토세", "new chitose", "chitose", "cts", "삿포로", "sapporo"],
  },
  // 나고야
  {
    id: "city-ngo",
    kind: "city",
    name: "나고야 (모두)",
    city: "나고야",
    country: "일본",
    countryId: "country-jp",
    keywords: ["나고야", "nagoya", "ngo", "일본", "japan"],
  },
  {
    id: "ngo",
    kind: "airport",
    name: "주부 센트레아 (NGO)",
    city: "나고야",
    country: "일본",
    code: "NGO",
    cityId: "city-ngo",
    keywords: ["센트레아", "chubu", "centrair", "ngo", "나고야", "nagoya"],
  },
  // 오키나와/나하
  {
    id: "city-oka",
    kind: "city",
    name: "오키나와/나하 (모두)",
    city: "오키나와",
    country: "일본",
    countryId: "country-jp",
    keywords: ["오키나와", "okinawa", "나하", "naha", "oka", "일본", "japan"],
  },
  {
    id: "oka",
    kind: "airport",
    name: "나하 (OKA)",
    city: "오키나와",
    country: "일본",
    code: "OKA",
    cityId: "city-oka",
    keywords: ["나하", "naha", "oka", "오키나와", "okinawa"],
  },
  // 기타큐슈
  {
    id: "city-kkj",
    kind: "city",
    name: "기타큐슈 (모두)",
    city: "기타큐슈",
    country: "일본",
    countryId: "country-jp",
    keywords: ["기타큐슈", "kitakyushu", "kkj", "일본", "japan"],
  },
  {
    id: "kkj",
    kind: "airport",
    name: "기타큐슈 (KKJ)",
    city: "기타큐슈",
    country: "일본",
    code: "KKJ",
    cityId: "city-kkj",
    keywords: ["기타큐슈", "kitakyushu", "kkj"],
  },
  // 구마모토
  {
    id: "city-kmj",
    kind: "city",
    name: "구마모토 (모두)",
    city: "구마모토",
    country: "일본",
    countryId: "country-jp",
    keywords: ["구마모토", "kumamoto", "kmj", "일본", "japan"],
  },
  {
    id: "kmj",
    kind: "airport",
    name: "구마모토 (KMJ)",
    city: "구마모토",
    country: "일본",
    code: "KMJ",
    cityId: "city-kmj",
    keywords: ["구마모토", "kumamoto", "kmj"],
  },
  // 가고시마
  {
    id: "city-koj",
    kind: "city",
    name: "가고시마 (모두)",
    city: "가고시마",
    country: "일본",
    countryId: "country-jp",
    keywords: ["가고시마", "kagoshima", "koj", "일본", "japan"],
  },
  {
    id: "koj",
    kind: "airport",
    name: "가고시마 (KOJ)",
    city: "가고시마",
    country: "일본",
    code: "KOJ",
    cityId: "city-koj",
    keywords: ["가고시마", "kagoshima", "koj"],
  },
  // 마쓰야마
  {
    id: "city-myj",
    kind: "city",
    name: "마쓰야마 (모두)",
    city: "마쓰야마",
    country: "일본",
    countryId: "country-jp",
    keywords: ["마쓰야마", "matsuyama", "myj", "일본", "japan"],
  },
  {
    id: "myj",
    kind: "airport",
    name: "마쓰야마 (MYJ)",
    city: "마쓰야마",
    country: "일본",
    code: "MYJ",
    cityId: "city-myj",
    keywords: ["마쓰야마", "matsuyama", "myj"],
  },
  // 다카마쓰
  {
    id: "city-tak",
    kind: "city",
    name: "다카마쓰 (모두)",
    city: "다카마쓰",
    country: "일본",
    countryId: "country-jp",
    keywords: ["다카마쓰", "takamatsu", "tak", "일본", "japan"],
  },
  {
    id: "tak",
    kind: "airport",
    name: "다카마쓰 (TAK)",
    city: "다카마쓰",
    country: "일본",
    code: "TAK",
    cityId: "city-tak",
    keywords: ["다카마쓰", "takamatsu", "tak"],
  },
  // 방콕
  {
    id: "city-bkk",
    kind: "city",
    name: "방콕 (모두)",
    city: "방콕",
    country: "태국",
    countryId: "country-th",
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
  // 치앙마이
  {
    id: "city-cnx",
    kind: "city",
    name: "치앙마이 (모두)",
    city: "치앙마이",
    country: "태국",
    countryId: "country-th",
    keywords: ["치앙마이", "chiang mai", "chiangmai", "cnx", "태국", "thailand"],
  },
  {
    id: "cnx",
    kind: "airport",
    name: "치앙마이 국제 (CNX)",
    city: "치앙마이",
    country: "태국",
    code: "CNX",
    cityId: "city-cnx",
    keywords: ["치앙마이", "chiang mai", "cnx"],
  },
  // 푸켓
  {
    id: "city-hkt",
    kind: "city",
    name: "푸켓 (모두)",
    city: "푸켓",
    country: "태국",
    countryId: "country-th",
    keywords: ["푸켓", "phuket", "hkt", "태국", "thailand"],
  },
  {
    id: "hkt",
    kind: "airport",
    name: "푸켓 국제 (HKT)",
    city: "푸켓",
    country: "태국",
    code: "HKT",
    cityId: "city-hkt",
    keywords: ["푸켓", "phuket", "hkt"],
  },
  // 다낭
  {
    id: "city-dad",
    kind: "city",
    name: "다낭 (모두)",
    city: "다낭",
    country: "베트남",
    countryId: "country-vn",
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
  // 하노이
  {
    id: "city-han",
    kind: "city",
    name: "하노이 (모두)",
    city: "하노이",
    country: "베트남",
    countryId: "country-vn",
    keywords: ["하노이", "hanoi", "han", "베트남", "vietnam"],
  },
  {
    id: "han",
    kind: "airport",
    name: "노이바이 (HAN)",
    city: "하노이",
    country: "베트남",
    code: "HAN",
    cityId: "city-han",
    keywords: ["노이바이", "noi bai", "han", "하노이", "hanoi"],
  },
  // 호치민
  {
    id: "city-sgn",
    kind: "city",
    name: "호치민 (모두)",
    city: "호치민",
    country: "베트남",
    countryId: "country-vn",
    keywords: ["호치민", "호찌민", "ho chi minh", "saigon", "sgn", "베트남", "vietnam"],
  },
  {
    id: "sgn",
    kind: "airport",
    name: "떤선녓 (SGN)",
    city: "호치민",
    country: "베트남",
    code: "SGN",
    cityId: "city-sgn",
    keywords: ["떤선녓", "tan son nhat", "sgn", "호치민", "saigon"],
  },
  // 나트랑/깜라인
  {
    id: "city-cxr",
    kind: "city",
    name: "나트랑 (모두)",
    city: "나트랑",
    country: "베트남",
    countryId: "country-vn",
    keywords: ["나트랑", "nha trang", "깜라인", "cam ranh", "cxr", "베트남", "vietnam"],
  },
  {
    id: "cxr",
    kind: "airport",
    name: "깜라인 국제 (CXR)",
    city: "나트랑",
    country: "베트남",
    code: "CXR",
    cityId: "city-cxr",
    keywords: ["깜라인", "cam ranh", "cxr", "나트랑", "nha trang"],
  },
  // 푸꾸옥
  {
    id: "city-pqc",
    kind: "city",
    name: "푸꾸옥 (모두)",
    city: "푸꾸옥",
    country: "베트남",
    countryId: "country-vn",
    keywords: ["푸꾸옥", "phu quoc", "pqc", "베트남", "vietnam"],
  },
  {
    id: "pqc",
    kind: "airport",
    name: "푸꾸옥 국제 (PQC)",
    city: "푸꾸옥",
    country: "베트남",
    code: "PQC",
    cityId: "city-pqc",
    keywords: ["푸꾸옥", "phu quoc", "pqc"],
  },
  // 파리
  {
    id: "city-par",
    kind: "city",
    name: "파리 (모두)",
    city: "파리",
    country: "프랑스",
    countryId: "country-fr",
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
    countryId: "country-gb",
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
    countryId: "country-us",
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
  // 몬트리올
  {
    id: "city-ymq",
    kind: "city",
    name: "몬트리올 (모두)",
    city: "몬트리올",
    country: "캐나다",
    countryId: "country-ca",
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
    countryId: "country-sg",
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
    countryId: "country-hk",
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
    countryId: "country-tw",
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
  // 가오슝
  {
    id: "city-khh",
    kind: "city",
    name: "가오슝 (모두)",
    city: "가오슝",
    country: "대만",
    countryId: "country-tw",
    keywords: ["가오슝", "kaohsiung", "khh", "대만", "taiwan"],
  },
  {
    id: "khh",
    kind: "airport",
    name: "가오슝 국제 (KHH)",
    city: "가오슝",
    country: "대만",
    code: "KHH",
    cityId: "city-khh",
    keywords: ["가오슝", "kaohsiung", "khh"],
  },
  // 베이징
  {
    id: "city-bjs",
    kind: "city",
    name: "베이징 (모두)",
    city: "베이징",
    country: "중국",
    countryId: "country-cn",
    keywords: ["베이징", "beijing", "bjs", "pek", "pkx", "중국", "china"],
  },
  {
    id: "pek",
    kind: "airport",
    name: "베이징 수도 (PEK)",
    city: "베이징",
    country: "중국",
    code: "PEK",
    cityId: "city-bjs",
    keywords: ["수도공항", "capital", "pek", "베이징", "beijing"],
  },
  {
    id: "pkx",
    kind: "airport",
    name: "베이징 다싱 (PKX)",
    city: "베이징",
    country: "중국",
    code: "PKX",
    cityId: "city-bjs",
    keywords: ["다싱", "daxing", "pkx", "베이징", "beijing"],
  },
  // 칭다오
  {
    id: "city-tao",
    kind: "city",
    name: "칭다오 (모두)",
    city: "칭다오",
    country: "중국",
    countryId: "country-cn",
    keywords: ["칭다오", "qingdao", "tao", "중국", "china"],
  },
  {
    id: "tao",
    kind: "airport",
    name: "칭다오 자오둥 (TAO)",
    city: "칭다오",
    country: "중국",
    code: "TAO",
    cityId: "city-tao",
    keywords: ["칭다오", "qingdao", "jiaodong", "tao"],
  },
  // 마카오
  {
    id: "city-mfm",
    kind: "city",
    name: "마카오 (모두)",
    city: "마카오",
    country: "중국",
    countryId: "country-cn",
    keywords: ["마카오", "macau", "macao", "mfm", "중국", "china"],
  },
  {
    id: "mfm",
    kind: "airport",
    name: "마카오 국제 (MFM)",
    city: "마카오",
    country: "중국",
    code: "MFM",
    cityId: "city-mfm",
    keywords: ["마카오", "macau", "macao", "mfm"],
  },
  // 시드니
  {
    id: "city-syd",
    kind: "city",
    name: "시드니 (모두)",
    city: "시드니",
    country: "호주",
    countryId: "country-au",
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
    countryId: "country-id",
    keywords: ["발리", "bali", "덴파사르", "denpasar", "dps"],
  },
  {
    id: "dps",
    kind: "airport",
    name: "응우라라이 (DPS)",
    city: "발리",
    country: "인도네시아",
    code: "DPS",
    cityId: "city-dps",
    keywords: ["응우라라이", "ngurah rai", "dps", "발리", "bali"],
  },
  // 로스앤젤레스
  {
    id: "city-lax",
    kind: "city",
    name: "로스앤젤레스 (모두)",
    city: "로스앤젤레스",
    country: "미국",
    countryId: "country-us",
    keywords: ["로스앤젤레스", "엘에이", "los angeles", "la", "lax", "미국", "usa"],
  },
  {
    id: "lax",
    kind: "airport",
    name: "로스앤젤레스 국제 (LAX)",
    city: "로스앤젤레스",
    country: "미국",
    code: "LAX",
    cityId: "city-lax",
    keywords: ["로스앤젤레스", "엘에이", "los angeles", "lax"],
  },
  // 샌프란시스코
  {
    id: "city-sfo",
    kind: "city",
    name: "샌프란시스코 (모두)",
    city: "샌프란시스코",
    country: "미국",
    countryId: "country-us",
    keywords: ["샌프란시스코", "san francisco", "sfo", "미국", "usa"],
  },
  {
    id: "sfo",
    kind: "airport",
    name: "샌프란시스코 국제 (SFO)",
    city: "샌프란시스코",
    country: "미국",
    code: "SFO",
    cityId: "city-sfo",
    keywords: ["샌프란시스코", "san francisco", "sfo"],
  },
  // 하와이 호놀룰루
  {
    id: "city-hnl",
    kind: "city",
    name: "호놀룰루 (모두)",
    city: "호놀룰루",
    country: "미국",
    countryId: "country-us",
    keywords: ["호놀룰루", "하와이", "honolulu", "hawaii", "hnl"],
  },
  {
    id: "hnl",
    kind: "airport",
    name: "대니얼 K. 이노우에 (HNL)",
    city: "호놀룰루",
    country: "미국",
    code: "HNL",
    cityId: "city-hnl",
    keywords: ["호놀룰루", "하와이", "honolulu", "hawaii", "hnl"],
  },
  // 괌
  {
    id: "city-gum",
    kind: "city",
    name: "괌 (모두)",
    city: "괌",
    country: "미국",
    countryId: "country-us",
    keywords: ["괌", "guam", "gum", "미국", "usa"],
  },
  {
    id: "gum",
    kind: "airport",
    name: "안토니오 B. 원 팻 (GUM)",
    city: "괌",
    country: "미국",
    code: "GUM",
    cityId: "city-gum",
    keywords: ["괌", "guam", "gum"],
  },
  // 사이판
  {
    id: "city-spn",
    kind: "city",
    name: "사이판 (모두)",
    city: "사이판",
    country: "미국",
    countryId: "country-us",
    keywords: ["사이판", "saipan", "spn", "미국", "usa"],
  },
  {
    id: "spn",
    kind: "airport",
    name: "사이판 국제 (SPN)",
    city: "사이판",
    country: "미국",
    code: "SPN",
    cityId: "city-spn",
    keywords: ["사이판", "saipan", "spn"],
  },
  // 로마
  {
    id: "city-rom",
    kind: "city",
    name: "로마 (모두)",
    city: "로마",
    country: "이탈리아",
    countryId: "country-it",
    keywords: ["로마", "rome", "rom", "이탈리아", "italy"],
  },
  {
    id: "fco",
    kind: "airport",
    name: "피우미치노 (FCO)",
    city: "로마",
    country: "이탈리아",
    code: "FCO",
    cityId: "city-rom",
    keywords: ["피우미치노", "fiumicino", "fco", "로마", "rome"],
  },
  // 바르셀로나
  {
    id: "city-bcn",
    kind: "city",
    name: "바르셀로나 (모두)",
    city: "바르셀로나",
    country: "스페인",
    countryId: "country-es",
    keywords: ["바르셀로나", "barcelona", "bcn", "스페인", "spain"],
  },
  {
    id: "bcn",
    kind: "airport",
    name: "바르셀로나 엘프라트 (BCN)",
    city: "바르셀로나",
    country: "스페인",
    code: "BCN",
    cityId: "city-bcn",
    keywords: ["바르셀로나", "barcelona", "el prat", "bcn"],
  },
  // 두바이
  {
    id: "city-dxb",
    kind: "city",
    name: "두바이 (모두)",
    city: "두바이",
    country: "아랍에미리트",
    countryId: "country-ae",
    keywords: ["두바이", "dubai", "dxb", "uae", "아랍"],
  },
  {
    id: "dxb",
    kind: "airport",
    name: "두바이 국제 (DXB)",
    city: "두바이",
    country: "아랍에미리트",
    code: "DXB",
    cityId: "city-dxb",
    keywords: ["두바이", "dubai", "dxb"],
  },
  // 프랑크푸르트
  {
    id: "city-fra",
    kind: "city",
    name: "프랑크푸르트 (모두)",
    city: "프랑크푸르트",
    country: "독일",
    countryId: "country-de",
    keywords: ["프랑크푸르트", "frankfurt", "fra", "독일", "germany"],
  },
  {
    id: "fra",
    kind: "airport",
    name: "프랑크푸르트 암마인 (FRA)",
    city: "프랑크푸르트",
    country: "독일",
    code: "FRA",
    cityId: "city-fra",
    keywords: ["프랑크푸르트", "frankfurt", "fra"],
  },
  // 상하이
  {
    id: "city-sha",
    kind: "city",
    name: "상하이 (모두)",
    city: "상하이",
    country: "중국",
    countryId: "country-cn",
    keywords: ["상하이", "shanghai", "sha", "중국", "china"],
  },
  {
    id: "pvg",
    kind: "airport",
    name: "푸동 (PVG)",
    city: "상하이",
    country: "중국",
    code: "PVG",
    cityId: "city-sha",
    keywords: ["푸동", "pudong", "pvg", "상하이", "shanghai"],
  },
  {
    id: "sha",
    kind: "airport",
    name: "홍차오 (SHA)",
    city: "상하이",
    country: "중국",
    code: "SHA",
    cityId: "city-sha",
    keywords: ["홍차오", "hongqiao", "sha", "상하이"],
  },
  // 마닐라
  {
    id: "city-mnl",
    kind: "city",
    name: "마닐라 (모두)",
    city: "마닐라",
    country: "필리핀",
    countryId: "country-ph",
    keywords: ["마닐라", "manila", "mnl", "필리핀", "philippines"],
  },
  {
    id: "mnl",
    kind: "airport",
    name: "니노이 아키노 (MNL)",
    city: "마닐라",
    country: "필리핀",
    code: "MNL",
    cityId: "city-mnl",
    keywords: ["마닐라", "manila", "아키노", "mnl"],
  },
  // 세부
  {
    id: "city-ceb",
    kind: "city",
    name: "세부 (모두)",
    city: "세부",
    country: "필리핀",
    countryId: "country-ph",
    keywords: ["세부", "cebu", "ceb", "필리핀", "philippines"],
  },
  {
    id: "ceb",
    kind: "airport",
    name: "막탄-세부 국제 (CEB)",
    city: "세부",
    country: "필리핀",
    code: "CEB",
    cityId: "city-ceb",
    keywords: ["세부", "cebu", "mactan", "ceb"],
  },
  // 보라카이/칼리보
  {
    id: "city-klo",
    kind: "city",
    name: "보라카이/칼리보 (모두)",
    city: "보라카이",
    country: "필리핀",
    countryId: "country-ph",
    keywords: ["보라카이", "boracay", "칼리보", "kalibo", "klo", "필리핀", "philippines"],
  },
  {
    id: "klo",
    kind: "airport",
    name: "칼리보 국제 (KLO)",
    city: "보라카이",
    country: "필리핀",
    code: "KLO",
    cityId: "city-klo",
    keywords: ["칼리보", "kalibo", "klo", "보라카이", "boracay"],
  },
  // 코타키나발루
  {
    id: "city-bki",
    kind: "city",
    name: "코타키나발루 (모두)",
    city: "코타키나발루",
    country: "말레이시아",
    keywords: ["코타키나발루", "kota kinabalu", "bki", "말레이시아", "malaysia"],
  },
  {
    id: "bki",
    kind: "airport",
    name: "코타키나발루 국제 (BKI)",
    city: "코타키나발루",
    country: "말레이시아",
    code: "BKI",
    cityId: "city-bki",
    keywords: ["코타키나발루", "kota kinabalu", "bki"],
  },
  // 쿠알라룸푸르
  {
    id: "city-kul",
    kind: "city",
    name: "쿠알라룸푸르 (모두)",
    city: "쿠알라룸푸르",
    country: "말레이시아",
    keywords: ["쿠알라룸푸르", "kuala lumpur", "kul", "kl", "말레이시아", "malaysia"],
  },
  {
    id: "kul",
    kind: "airport",
    name: "쿠알라룸푸르 국제 (KUL)",
    city: "쿠알라룸푸르",
    country: "말레이시아",
    code: "KUL",
    cityId: "city-kul",
    keywords: ["쿠알라룸푸르", "kuala lumpur", "kul"],
  },
  // 블라디보스토크
  {
    id: "city-vvo",
    kind: "city",
    name: "블라디보스토크 (모두)",
    city: "블라디보스토크",
    country: "러시아",
    keywords: ["블라디보스토크", "vladivostok", "vvo", "러시아", "russia"],
  },
  {
    id: "vvo",
    kind: "airport",
    name: "블라디보스토크 국제 (VVO)",
    city: "블라디보스토크",
    country: "러시아",
    code: "VVO",
    cityId: "city-vvo",
    keywords: ["블라디보스토크", "vladivostok", "vvo"],
  },
  // 울란바토르
  {
    id: "city-ubn",
    kind: "city",
    name: "울란바토르 (모두)",
    city: "울란바토르",
    country: "몽골",
    keywords: ["울란바토르", "ulaanbaatar", "ulan bator", "ubn", "몽골", "mongolia"],
  },
  {
    id: "ubn",
    kind: "airport",
    name: "칭기스 칸 (UBN)",
    city: "울란바토르",
    country: "몽골",
    code: "UBN",
    cityId: "city-ubn",
    keywords: ["울란바토르", "ulaanbaatar", "chinggis", "ubn"],
  },
];

/** 검색창을 열었을 때 보여줄 인기 도시·공항 (전 세계) */
export const POPULAR_PLACE_IDS = [
  "city-sel",
  "icn",
  "gmp",
  "city-pus",
  "pus",
  "city-cju",
  "cju",
  "city-tyo",
  "hnd",
  "nrt",
  "city-osa",
  "kix",
  "city-fuk",
  "fuk",
  "city-bkk",
  "bkk",
  "city-hkt",
  "hkt",
  "city-dad",
  "dad",
  "city-sin",
  "sin",
  "city-hkg",
  "hkg",
  "city-tpe",
  "tpe",
  "city-dps",
  "dps",
  "city-mnl",
  "mnl",
  "city-par",
  "cdg",
  "city-lon",
  "lhr",
  "city-rom",
  "fco",
  "city-bcn",
  "bcn",
  "city-fra",
  "fra",
  "city-dxb",
  "dxb",
  "city-nyc",
  "jfk",
  "city-lax",
  "lax",
  "city-sfo",
  "sfo",
  "city-hnl",
  "hnl",
  "city-syd",
  "syd",
  "city-sha",
  "pvg",
] as const;

/** 공항 입력/표시용 공식 명칭 (예: 인천국제공항(ICN)) */
export const AIRPORT_OFFICIAL_NAMES: Record<string, string> = {
  ICN: "인천국제공항",
  GMP: "김포국제공항",
  PUS: "김해국제공항",
  CJU: "제주국제공항",
  TAE: "대구국제공항",
  CJJ: "청주국제공항",
  KWJ: "광주공항",
  YNY: "양양국제공항",
  MWX: "무안국제공항",
  HND: "하네다공항",
  NRT: "나리타국제공항",
  KIX: "간사이국제공항",
  ITM: "오사카국제공항",
  FUK: "후쿠오카공항",
  CTS: "신치토세공항",
  NGO: "중부국제공항",
  OKA: "나하공항",
  KKJ: "기타큐슈공항",
  KMJ: "구마모토공항",
  KOJ: "가고시마공항",
  MYJ: "마쓰야마공항",
  TAK: "다카마쓰공항",
  BKK: "수완나품국제공항",
  DMK: "돈므앙국제공항",
  HKT: "푸켓국제공항",
  CNX: "치앙마이국제공항",
  DAD: "다낭국제공항",
  HAN: "노이바이국제공항",
  SGN: "떤선녓국제공항",
  CXR: "깜라인국제공항",
  PQC: "푸꾸옥국제공항",
  CDG: "샤를드골공항",
  ORY: "오를리공항",
  LHR: "히드로공항",
  LGW: "개트윅공항",
  STN: "스탠스테드공항",
  FCO: "피우미치노공항",
  BCN: "엘프라트공항",
  FRA: "프랑크푸르트공항",
  DXB: "두바이국제공항",
  JFK: "존 F. 케네디국제공항",
  EWR: "뉴어크리버티국제공항",
  LGA: "라과디아공항",
  LAX: "로스앤젤레스국제공항",
  SFO: "샌프란시스코국제공항",
  HNL: "호놀룰루국제공항",
  GUM: "괌국제공항",
  SPN: "사이판국제공항",
  YUL: "몬트리올트루도공항",
  YHU: "몬트리올생위베르공항",
  SIN: "창이국제공항",
  HKG: "홍콩국제공항",
  TPE: "타오위안국제공항",
  TSA: "송산공항",
  KHH: "가오슝국제공항",
  PEK: "베이징수도국제공항",
  PKX: "베이징다싱국제공항",
  TAO: "칭다오자오둥국제공항",
  MFM: "마카오국제공항",
  SYD: "킹스포드스미스공항",
  DPS: "응우라라이국제공항",
  MNL: "니노이아키노국제공항",
  CEB: "막탄세부국제공항",
  KLO: "칼리보국제공항",
  BKI: "코타키나발루국제공항",
  KUL: "쿠알라룸푸르국제공항",
  PVG: "푸동국제공항",
  SHA: "홍차오공항",
  VVO: "블라디보스토크국제공항",
  UBN: "칭기스칸국제공항",
};

/** 항공권 검색 입력란 표시 (예: 인천국제공항(ICN)) */
export function formatAirportInputLabel(place: AirportPlace): string {
  if (place.kind === "country") {
    return place.name;
  }
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

export function formatAirportKeyword(keyword: string): string {
  // 순환 import 방지: 간단한 로컬 조회 (search.findAirportPlaceByQuery와 동일 목적)
  const trimmed = keyword.trim();
  if (!trimmed) return keyword;
  const paren = trimmed.match(/\(([A-Za-z]{3})\)\s*$/);
  if (paren) {
    const byCode = AIRPORT_PLACES.find(
      (place) => place.code?.toUpperCase() === paren[1].toUpperCase()
    );
    if (byCode) return formatAirportInputLabel(byCode);
  }
  const q = trimmed.toLowerCase().replace(/\s+/g, " ");
  const found =
    AIRPORT_PLACES.find((place) => {
      if (place.kind === "country") return false;
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
    }) ?? null;
  return found ? formatAirportInputLabel(found) : keyword;
}

/** 표시 라벨 — 도시 선택 시 "(모두)"·공항코드 없이 도시명 */
export function formatPlaceLabel(place: AirportPlace): string {
  if (place.kind === "country") return place.name;
  if (place.kind === "city") return place.city;
  return place.code ? `${place.city} (${place.code})` : place.name;
}

/** 온보딩/일정용: 도시 · 나라 (공항코드 없음). 나라 항목은 "일본 (전체)" */
export function formatCityCountryLabel(place: AirportPlace): string {
  if (place.kind === "country") return place.name;
  if (place.country) return `${place.city}, ${place.country}`;
  return place.city || place.name;
}

export function formatDestinationForPlan(place: AirportPlace): string {
  return formatCityCountryLabel(place);
}

/** 인기 도시만 (공항코드·나라 항목 제외) */
export function getPopularCities(limit = 24): AirportPlace[] {
  const cities: AirportPlace[] = [];
  const seen = new Set<string>();
  for (const id of POPULAR_PLACE_IDS) {
    const place = AIRPORT_PLACES.find((p) => p.id === id);
    if (!place) continue;
    const cityPlace =
      place.kind === "city"
        ? place
        : AIRPORT_PLACES.find(
            (p) => p.kind === "city" && p.id === place.cityId
          ) ?? null;
    if (!cityPlace || seen.has(cityPlace.id)) continue;
    seen.add(cityPlace.id);
    cities.push(cityPlace);
    if (cities.length >= limit) break;
  }
  return cities;
}
