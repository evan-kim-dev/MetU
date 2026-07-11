/**
 * Destination cover images — city/country curated Unsplash URLs + sync resolver.
 * Unknown places fall back to country, then a scenic default (never the empty bag photo).
 */

const U = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

/** Old generic “travel bag” / blank-looking fallback stored on many trips */
export const GENERIC_TRIP_IMAGE_MARKERS = [
  "photo-1488646953014",
  "photo-1469854523086",
] as const;

export const DEFAULT_DESTINATION_IMAGE = U("photo-1469474968028-56623f02e42e"); // scenic mountains

const CITY_IMAGES: Record<string, string> = {
  // Korea
  서울: U("photo-1534274988757-a28bf1a57c17"),
  부산: U("photo-1542051841857-5f90071e7989"),
  제주: U("photo-1590559899731-a382839e5549"),
  인천: U("photo-1534274988757-a28bf1a57c17"),
  // Japan
  도쿄: U("photo-1540959733332-eab4deabeeaf"),
  오사카: U("photo-1590559899731-a382839e5549"),
  교토: U("photo-1493976040374-85c8e12f0c0e"),
  후쿠오카: U("photo-1528164344705-47542687000d"),
  삿포로: U("photo-1542051841857-5f90071e7989"),
  나고야: U("photo-1528164344705-47542687000d"),
  오키나와: U("photo-1545569341-9ba8e6fa8ff5"),
  tokyo: U("photo-1540959733332-eab4deabeeaf"),
  osaka: U("photo-1590559899731-a382839e5549"),
  // Thailand
  방콕: U("photo-1508009603885-50cf7c579365"),
  푸켓: U("photo-1589394815804-964ed0be2eb5"),
  치앙마이: U("photo-1528181304800-259b08848526"),
  파타야: U("photo-1552465011-b4e21bf6e79a"),
  bangkok: U("photo-1508009603885-50cf7c579365"),
  phuket: U("photo-1589394815804-964ed0be2eb5"),
  // Vietnam
  다낭: U("photo-1559592413-7cec4b0e8f9f"),
  하노이: U("photo-1528127269322-539801943592"),
  호치민: U("photo-1583417267826-aebc4d1542e1"),
  나트랑: U("photo-1559592413-7cec4b0e8f9f"),
  danang: U("photo-1559592413-7cec4b0e8f9f"),
  // Taiwan / HK / Singapore / Malaysia / Philippines / Indonesia
  타이베이: U("photo-1598935898639-81586f7d2129"),
  홍콩: U("photo-1536599018102-9f803c140fc1"),
  싱가포르: U("photo-1525625293386-3f8f99389edd"),
  쿠알라룸푸르: U("photo-1596422846543-75c6fc197f07"),
  세부: U("photo-1518509562904-e7ef99cdcc86"),
  마닐라: U("photo-1518509562904-e7ef99cdcc86"),
  발리: U("photo-1537996194471-e657df975ab4"),
  자카르타: U("photo-1555899434-94d8160f48c1"),
  // Europe
  파리: U("photo-1502602898657-3e91760cbb34"),
  런던: U("photo-1513635269975-59663e0ac1ad"),
  로마: U("photo-1552832230-c0197dd311b5"),
  바르셀로나: U("photo-1583422409516-2895a77efded"),
  마드리드: U("photo-1539037116277-4db20889f2d4"),
  프라하: U("photo-1541849546-216549ae216d"),
  암스테르담: U("photo-1534351590666-13e3e96b5017"),
  베를린: U("photo-1560969184-10fe8719e047"),
  빈: U("photo-1516550893923-42d28e5677af"),
  // Americas / Oceania / Middle East
  뉴욕: U("photo-1496442226666-8d4d0e62e6e9"),
  로스앤젤레스: U("photo-1534190760961-74e525a07a9d"),
  시드니: U("photo-1506973035872-a4ec16b8e8d9"),
  멜버른: U("photo-1514395462725-fb4566210144"),
  괌: U("photo-1559128010-7c1ad6e1b6a0"),
  두바이: U("photo-1512453979798-5ea266f8880c"),
  // China
  베이징: U("photo-1508804185872-d7aad8140a95"),
  상하이: U("photo-1538426450438-5a6ad0d4d7e8"),
};

const COUNTRY_IMAGES: Record<string, string> = {
  한국: U("photo-1534274988757-a28bf1a57c17"),
  대한민국: U("photo-1534274988757-a28bf1a57c17"),
  일본: U("photo-1540959733332-eab4deabeeaf"),
  태국: U("photo-1508009603885-50cf7c579365"),
  베트남: U("photo-1559592413-7cec4b0e8f9f"),
  대만: U("photo-1598935898639-81586f7d2129"),
  홍콩: U("photo-1536599018102-9f803c140fc1"),
  싱가포르: U("photo-1525625293386-3f8f99389edd"),
  말레이시아: U("photo-1596422846543-75c6fc197f07"),
  필리핀: U("photo-1518509562904-e7ef99cdcc86"),
  인도네시아: U("photo-1537996194471-e657df975ab4"),
  중국: U("photo-1508804185872-d7aad8140a95"),
  프랑스: U("photo-1502602898657-3e91760cbb34"),
  영국: U("photo-1513635269975-59663e0ac1ad"),
  이탈리아: U("photo-1552832230-c0197dd311b5"),
  스페인: U("photo-1583422409516-2895a77efded"),
  미국: U("photo-1496442226666-8d4d0e62e6e9"),
  호주: U("photo-1506973035872-a4ec16b8e8d9"),
  독일: U("photo-1560969184-10fe8719e047"),
  네덜란드: U("photo-1534351590666-13e3e96b5017"),
  thailand: U("photo-1508009603885-50cf7c579365"),
  japan: U("photo-1540959733332-eab4deabeeaf"),
  vietnam: U("photo-1559592413-7cec4b0e8f9f"),
};

/** Korean/common labels → English Wikipedia page titles */
const WIKI_TITLE_HINTS: Record<string, string> = {
  푸켓: "Phuket",
  방콕: "Bangkok",
  치앙마이: "Chiang Mai",
  파타야: "Pattaya",
  다낭: "Da Nang",
  하노이: "Hanoi",
  호치민: "Ho Chi Minh City",
  나트랑: "Nha Trang",
  도쿄: "Tokyo",
  오사카: "Osaka",
  교토: "Kyoto",
  후쿠오카: "Fukuoka",
  삿포로: "Sapporo",
  오키나와: "Okinawa Prefecture",
  타이베이: "Taipei",
  홍콩: "Hong Kong",
  싱가포르: "Singapore",
  쿠알라룸푸르: "Kuala Lumpur",
  세부: "Cebu",
  마닐라: "Manila",
  발리: "Bali",
  자카르타: "Jakarta",
  파리: "Paris",
  런던: "London",
  로마: "Rome",
  바르셀로나: "Barcelona",
  뉴욕: "New York City",
  시드니: "Sydney",
  괌: "Guam",
  두바이: "Dubai",
  서울: "Seoul",
  부산: "Busan",
  제주: "Jeju Island",
  베이징: "Beijing",
  상하이: "Shanghai",
  태국: "Thailand",
  일본: "Japan",
  베트남: "Vietnam",
  필리핀: "Philippines",
  인도네시아: "Indonesia",
  대만: "Taiwan",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchInMap(label: string, map: Record<string, string>): string | null {
  const raw = label.trim();
  if (!raw) return null;
  if (map[raw]) return map[raw];

  const lower = normalizeKey(raw);
  for (const [key, url] of Object.entries(map)) {
    const k = normalizeKey(key);
    if (lower === k || lower.includes(k) || k.includes(lower)) return url;
  }
  return null;
}

export function isGenericTripImage(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return true;
  return GENERIC_TRIP_IMAGE_MARKERS.some((marker) => url.includes(marker));
}

/**
 * Sync resolve: city → country → scenic default.
 * Prefer this for SSR / plan generation; client may upgrade via Wikipedia API.
 */
export function resolveDestinationImage(
  destination: string,
  country?: string
): string {
  const cityHit = matchInMap(destination, CITY_IMAGES);
  if (cityHit) return cityHit;

  // "푸켓, 태국" / "Phuket · ..." style
  const cityPart = destination.split(/[,，·]/)[0]?.trim() ?? destination;
  const cityPartHit = matchInMap(cityPart, CITY_IMAGES);
  if (cityPartHit) return cityPartHit;

  if (country) {
    const countryHit = matchInMap(country, COUNTRY_IMAGES);
    if (countryHit) return countryHit;
  }

  return DEFAULT_DESTINATION_IMAGE;
}

export function wikiTitleCandidates(
  destination: string,
  country?: string
): string[] {
  const cityPart = destination.split(/[,，·]/)[0]?.trim() || destination.trim();
  const titles: string[] = [];

  const hint = WIKI_TITLE_HINTS[cityPart] ?? WIKI_TITLE_HINTS[normalizeKey(cityPart)];
  if (hint) titles.push(hint);

  if (cityPart) titles.push(cityPart);

  if (country) {
    const countryHint =
      WIKI_TITLE_HINTS[country.trim()] ??
      WIKI_TITLE_HINTS[normalizeKey(country)];
    if (countryHint) titles.push(countryHint);
    titles.push(country.trim());
  }

  return [...new Set(titles.filter(Boolean))];
}

/** Prefer stored URL only when it looks destination-specific. */
export function pickTripImageUrl(params: {
  storedUrl?: string | null;
  destination: string;
  country?: string;
}): string {
  if (params.storedUrl && !isGenericTripImage(params.storedUrl)) {
    return params.storedUrl;
  }
  return resolveDestinationImage(params.destination, params.country);
}
