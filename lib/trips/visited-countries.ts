/**
 * Korean/English country labels → ISO 3166-1 numeric (world-atlas id).
 */

const NAME_TO_ISO_NUMERIC: Record<string, string> = {
  // East / SE Asia
  한국: "410",
  대한민국: "410",
  korea: "410",
  "south korea": "410",
  일본: "392",
  japan: "392",
  중국: "156",
  china: "156",
  대만: "158",
  taiwan: "158",
  홍콩: "344",
  "hong kong": "344",
  마카오: "446",
  macau: "446",
  태국: "764",
  thailand: "764",
  베트남: "704",
  vietnam: "704",
  필리핀: "608",
  philippines: "608",
  싱가포르: "702",
  singapore: "702",
  말레이시아: "458",
  malaysia: "458",
  인도네시아: "360",
  indonesia: "360",
  캄보디아: "116",
  cambodia: "116",
  라오스: "418",
  laos: "418",
  미얀마: "104",
  myanmar: "104",
  브루나이: "96",
  brunei: "96",
  // Oceania
  호주: "36",
  australia: "36",
  뉴질랜드: "554",
  "new zealand": "554",
  괌: "316",
  guam: "316",
  피지: "242",
  fiji: "242",
  // Americas
  미국: "840",
  usa: "840",
  america: "840",
  "united states": "840",
  캐나다: "124",
  canada: "124",
  멕시코: "484",
  mexico: "484",
  브라질: "76",
  brazil: "76",
  페루: "604",
  peru: "604",
  아르헨티나: "32",
  argentina: "32",
  // Europe
  영국: "826",
  uk: "826",
  "united kingdom": "826",
  프랑스: "250",
  france: "250",
  독일: "276",
  germany: "276",
  이탈리아: "380",
  italy: "380",
  스페인: "724",
  spain: "724",
  포르투갈: "620",
  portugal: "620",
  네덜란드: "528",
  netherlands: "528",
  벨기에: "56",
  belgium: "56",
  스위스: "756",
  switzerland: "756",
  오스트리아: "40",
  austria: "40",
  체코: "203",
  "czech republic": "203",
  czechia: "203",
  그리스: "300",
  greece: "300",
  덴마크: "208",
  denmark: "208",
  스웨덴: "752",
  sweden: "752",
  노르웨이: "578",
  norway: "578",
  핀란드: "246",
  finland: "246",
  아일랜드: "372",
  ireland: "372",
  헝가리: "348",
  hungary: "348",
  폴란드: "616",
  poland: "616",
  크로아티아: "191",
  croatia: "191",
  튀르키예: "792",
  터키: "792",
  turkey: "792",
  turkiye: "792",
  // Middle East / Other Asia
  아랍에미리트: "784",
  uae: "784",
  두바이: "784",
  dubai: "784",
  카타르: "634",
  qatar: "634",
  인도: "356",
  india: "356",
  네팔: "524",
  nepal: "524",
  스리랑카: "144",
  "sri lanka": "144",
  몰디브: "462",
  maldives: "462",
  몽골: "496",
  mongolia: "496",
  // Africa
  이집트: "818",
  egypt: "818",
  모로코: "504",
  morocco: "504",
  남아프리카공화국: "710",
  "south africa": "710",
  // Destinations often stored as city-as-country
  발리: "360",
  bali: "360",
  오키나와: "392",
  okinawa: "392",
  도쿄: "392",
  오사카: "392",
  방콕: "764",
  푸켓: "764",
  다낭: "704",
  타이베이: "158",
  파리: "250",
  런던: "826",
  로마: "380",
  바르셀로나: "724",
  뉴욕: "840",
  하와이: "840",
  hawaii: "840",
  시드니: "36",
};

const ISO_NUMERIC_TO_LABEL: Record<string, string> = {
  "410": "한국",
  "392": "일본",
  "156": "중국",
  "158": "대만",
  "344": "홍콩",
  "764": "태국",
  "704": "베트남",
  "608": "필리핀",
  "702": "싱가포르",
  "458": "말레이시아",
  "360": "인도네시아",
  "116": "캄보디아",
  "36": "호주",
  "554": "뉴질랜드",
  "316": "괌",
  "840": "미국",
  "124": "캐나다",
  "826": "영국",
  "250": "프랑스",
  "276": "독일",
  "380": "이탈리아",
  "724": "스페인",
  "620": "포르투갈",
  "528": "네덜란드",
  "756": "스위스",
  "40": "오스트리아",
  "300": "그리스",
  "792": "튀르키예",
  "784": "UAE",
  "356": "인도",
  "462": "몰디브",
};

const ISO_NUMERIC_TO_ALPHA2: Record<string, string> = {
  "410": "KR",
  "392": "JP",
  "156": "CN",
  "158": "TW",
  "344": "HK",
  "764": "TH",
  "704": "VN",
  "608": "PH",
  "702": "SG",
  "458": "MY",
  "360": "ID",
  "116": "KH",
  "36": "AU",
  "554": "NZ",
  "316": "GU",
  "840": "US",
  "124": "CA",
  "826": "GB",
  "250": "FR",
  "276": "DE",
  "380": "IT",
  "724": "ES",
  "620": "PT",
  "528": "NL",
  "756": "CH",
  "40": "AT",
  "300": "GR",
  "792": "TR",
  "784": "AE",
  "356": "IN",
  "462": "MV",
  "96": "BN",
  "418": "LA",
  "104": "MM",
  "242": "FJ",
  "484": "MX",
  "76": "BR",
  "604": "PE",
  "32": "AR",
  "56": "BE",
  "203": "CZ",
  "208": "DK",
  "752": "SE",
  "578": "NO",
  "246": "FI",
  "372": "IE",
  "348": "HU",
  "616": "PL",
  "191": "HR",
  "634": "QA",
  "524": "NP",
  "144": "LK",
  "496": "MN",
  "818": "EG",
  "504": "MA",
  "710": "ZA",
  "446": "MO",
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve ISO numeric id from free-text country/destination. */
export function resolveCountryIsoNumeric(
  country: string,
  destination = ""
): string | null {
  const chunks = `${country} ${destination}`
    .split(/[,/|·]/)
    .map((part) => normalize(part))
    .filter(Boolean);

  for (const chunk of chunks) {
    const exact = NAME_TO_ISO_NUMERIC[chunk];
    if (exact) return exact;
  }

  const joined = normalize(`${country} ${destination}`);
  for (const [label, iso] of Object.entries(NAME_TO_ISO_NUMERIC)) {
    if (joined.includes(label)) return iso;
  }

  return null;
}

export function countryLabelFromIso(isoNumeric: string): string {
  return ISO_NUMERIC_TO_LABEL[isoNumeric] ?? `국가 ${isoNumeric}`;
}

/** ISO numeric → ISO 3166-1 alpha-2 (e.g. TH). */
export function countryAlpha2FromIso(isoNumeric: string): string | null {
  return ISO_NUMERIC_TO_ALPHA2[isoNumeric] ?? null;
}

/** ISO numeric → regional-indicator flag emoji (e.g. 🇹🇭). */
export function countryFlagFromIso(isoNumeric: string): string {
  const alpha2 = countryAlpha2FromIso(isoNumeric);
  if (!alpha2 || alpha2.length !== 2) return "🏳️";
  const chars = alpha2.toUpperCase();
  return String.fromCodePoint(
    ...[...chars].map((ch) => 0x1f1e6 - 65 + ch.charCodeAt(0))
  );
}

const COUNTRY_BLURBS: Record<string, string> = {
  "410": "사계절이 뚜렷하고 도시·자연·미식이 고르게 매력적인 여행지예요.",
  "392": "편리한 대중교통과 세심한 서비스, 미식·온천·쇼핑이 강한 나라예요.",
  "764": "따뜻한 기후와 사원·해변·길거리 음식이 인상적인 동남아 대표 여행지예요.",
  "704": "합리적인 물가와 해안·역사 도시가 잘 어우러진 여행지예요.",
  "608": "섬·비치·다이빙 중심의 휴양 여행에 잘 맞는 나라예요.",
  "702": "작지만 세련된 도시국가로, 짧은 일정에도 밀도가 높아요.",
  "458": "도시와 섬·정글이 가까워 일정 조합이 자유로운 편이에요.",
  "360": "발리부터 자카르타까지 휴양과 도시 여행 스펙트럼이 넓어요.",
  "158": "야시장·차·자연이 가까운 컴팩트한 여행지예요.",
  "156": "광활한 국토만큼 도시마다 분위기 차이가 큰 여행지예요.",
  "344": "야경과 미식, 쇼핑이 강한 고밀도 도시 여행지예요.",
  "36": "넓은 자연과 도시가 공존하는, 여유로운 장기 여행에 잘 맞아요.",
  "840": "지역마다 색깔이 전혀 달라 테마형 일정에 강한 나라예요.",
  "826": "역사·뮤지엄·펍 문화가 매력적인 유럽 대표 여행지예요.",
  "250": "예술·미식·산책 동선이 아름다운 낭만 여행의 정석이에요.",
  "276": "크리스마스 마켓·도시 산책·효율적인 이동이 강점이에요.",
  "380": "유적·미식·해안 도시가 촘촘히 이어지는 클래식 유럽 코스예요.",
  "724": "정열적인 도시 분위기와 해안 휴양이 함께 있는 나라예요.",
  "792": "유럽과 아시아의 경계에서 역사와 시장 문화가 강한 편이에요.",
  "784": "초현대적 스카이라인과 사막·휴양이 가까운 단기 여행지예요.",
  "356": "다채로운 문화와 향신료 미식이 인상적인 대규모 여행지예요.",
  "462": "수상 빌라와 스노클링으로 유명한 대표 휴양지예요.",
  "316": "미군 기지 문화와 열대 비치가 공존하는 짧은 휴양지예요.",
};

export function countryBlurbFromIso(isoNumeric: string): string {
  return (
    COUNTRY_BLURBS[isoNumeric] ??
    "여행 기록을 남기며 나만의 방문 노트를 채워 보세요."
  );
}

export function collectVisitedCountryIsos(
  trips: { country: string; destination: string }[]
): string[] {
  const set = new Set<string>();
  for (const trip of trips) {
    const iso = resolveCountryIsoNumeric(trip.country, trip.destination);
    if (iso) set.add(iso);
  }
  return [...set];
}
