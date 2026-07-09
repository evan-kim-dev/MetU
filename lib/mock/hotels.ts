export type DemoHotelItem = {
  id: string;
  name: string;
  area: string;
  rating?: number | null;
  reviewCount?: number | null;
  price: string;
  badge: string;
};

const TOKYO_DEMO_HOTELS: DemoHotelItem[] = [
  {
    id: "demo-trunk-shibuya",
    name: "TRUNK HOTEL",
    area: "도쿄 · 시부야",
    rating: 4.5,
    reviewCount: 1280,
    price: "₩245,000",
    badge: "무료취소",
  },
  {
    id: "demo-excel-tokyu",
    name: "시부야 엑셀 호텔 토클릉",
    area: "도쿄 · 시부야역 도보 5분",
    rating: 4.2,
    reviewCount: 3420,
    price: "₩128,000",
    badge: "가성비",
  },
  {
    id: "demo-sequence-miyashita",
    name: "sequence MIYASHITA PARK",
    area: "도쿄 · 미야시타 파크",
    rating: 4.6,
    reviewCount: 890,
    price: "₩312,000",
    badge: "디자인호텔",
  },
  {
    id: "demo-metropolitan-shibuya",
    name: "호텔 메트로폴리탄 시부야",
    area: "도쿄 · 시부야",
    rating: 4.0,
    reviewCount: 2100,
    price: "₩98,000",
    badge: "조식포함",
  },
];

const OSAKA_DEMO_HOTELS: DemoHotelItem[] = [
  {
    id: "demo-cross-osaka",
    name: "크로스 호텔 오사카",
    area: "오사카 · 도톤보리",
    rating: 4.4,
    reviewCount: 1560,
    price: "₩156,000",
    badge: "인기",
  },
  {
    id: "demo-granvia-osaka",
    name: "호텔 그랑비아 오사카",
    area: "오사카 · 오사카역",
    rating: 4.3,
    reviewCount: 2890,
    price: "₩189,000",
    badge: "역세권",
  },
  {
    id: "demo-apa-namba",
    name: "APA 호텔 난바 에키마에",
    area: "오사카 · 난바",
    rating: 4.1,
    reviewCount: 980,
    price: "₩72,000",
    badge: "가성비",
  },
];

const DEFAULT_DEMO_HOTELS: DemoHotelItem[] = [
  {
    id: "demo-city-comfort",
    name: "시티 컴포트 호텔",
    area: "시내 중심가",
    rating: 4.2,
    reviewCount: 640,
    price: "₩118,000",
    badge: "추천",
  },
  {
    id: "demo-boutique-stay",
    name: "부티크 스테이",
    area: "관광지 인근",
    rating: 4.4,
    reviewCount: 420,
    price: "₩165,000",
    badge: "무료취소",
  },
  {
    id: "demo-budget-inn",
    name: "이코노미 인",
    area: "역 근처",
    rating: 3.9,
    reviewCount: 1120,
    price: "₩68,000",
    badge: "가성비",
  },
];

function matchesDestination(destination: string, keywords: string[]): boolean {
  const normalized = destination.toLowerCase().replace(/\s+/g, " ");
  return keywords.some((keyword) => normalized.includes(keyword));
}

/** API 결과가 없을 때 UI에 보여줄 데모 숙소 목록 */
export function getDemoHotels(destination: string): DemoHotelItem[] {
  const areaLabel = destination.trim() || "추천 지역";

  if (
    matchesDestination(destination, [
      "도쿄",
      "시부야",
      "아사쿠사",
      "tokyo",
      "shibuya",
      "asakusa",
    ])
  ) {
    return TOKYO_DEMO_HOTELS;
  }

  if (matchesDestination(destination, ["오사카", "osaka", "난바", "namba"])) {
    return OSAKA_DEMO_HOTELS;
  }

  return DEFAULT_DEMO_HOTELS.map((hotel) => ({
    ...hotel,
    area: areaLabel,
  }));
}
