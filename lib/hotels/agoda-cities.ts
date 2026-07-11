/** Agoda 숙소 검색용 city ID (숫자) */
const AGODA_CITY_IDS: Record<string, number> = {
  서울: 14690,
  seoul: 14690,
  부산: 9394,
  busan: 9394,
  제주: 16901,
  jeju: 16901,
  도쿄: 5085,
  tokyo: 5085,
  시부야: 5085,
  shibuya: 5085,
  아사쿠사: 5085,
  오사카: 9590,
  osaka: 9590,
  교토: 1784,
  kyoto: 1784,
  후쿠오카: 16527,
  fukuoka: 16527,
  방콕: 9395,
  bangkok: 9395,
  싱가포르: 4064,
  singapore: 4064,
  하노이: 2758,
  hanoi: 2758,
  다낭: 16440,
  "da nang": 16440,
  danang: 16440,
  마닐라: 1622,
  manila: 1622,
  쿠알라룸푸르: 14524,
  "kuala lumpur": 14524,
  발리: 17193,
  bali: 17193,
  덴파사르: 17193,
  denpasar: 17193,
  홍콩: 16808,
  "hong kong": 16808,
  타이베이: 4951,
  taipei: 4951,
  상하이: 3987,
  shanghai: 3987,
  베이징: 1569,
  beijing: 1569,
  파리: 15470,
  paris: 15470,
  런던: 233,
  london: 233,
  로마: 16594,
  rome: 16594,
  바르셀로나: 5123,
  barcelona: 5123,
  암스테르담: 358,
  amsterdam: 358,
  뉴욕: 318,
  "new york": 318,
  로스앤젤레스: 12772,
  "los angeles": 12772,
  두바이: 2994,
  dubai: 2994,
  시드니: 14370,
  sydney: 14370,
  몬트리올: 3755,
  montreal: 3755,
  호치민: 13170,
  "ho chi minh": 13170,
};

function normalizeDestinationKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractCityLabel(destination: string): string {
  return destination.split(/[,，·]/)[0]?.trim() ?? destination.trim();
}

/** 목적지 문자열에서 Agoda city ID를 찾는다. */
export function resolveAgodaCityId(destination: string): number | null {
  const trimmed = destination.trim();
  if (!trimmed) return null;

  const cityLabel = extractCityLabel(trimmed);
  const keys = [
    normalizeDestinationKey(trimmed),
    normalizeDestinationKey(cityLabel),
  ];

  for (const key of keys) {
    if (key in AGODA_CITY_IDS) {
      return AGODA_CITY_IDS[key];
    }
  }

  for (const [label, cityId] of Object.entries(AGODA_CITY_IDS)) {
    const normalizedLabel = normalizeDestinationKey(label);
    if (
      keys.some(
        (key) => key.includes(normalizedLabel) || normalizedLabel.includes(key)
      )
    ) {
      return cityId;
    }
  }

  return null;
}
