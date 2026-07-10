export interface DealPlace {
  id: string;
  name: string;
  country: string;
  /** 예산 구간 라벨 (예: 50만원대) */
  budgetLabel: string;
  /** 예산 구간 하한 (정렬/필터용) */
  budgetBand: number;
  imageUrl: string;
  /** 1인 왕복+숙소 기준 예상 총액 */
  fromPrice: number;
  nights: number;
  /** AI가 수집한 항공 최저가 (1인 왕복) */
  flightFrom: number;
  /** AI가 수집한 숙소 최저가 (총액) */
  hotelFrom: number;
  airline: string;
  route: string;
  bestMonth: string;
  highlight: string;
}

export interface DealDetail {
  id: string;
  name: string;
  country: string;
  imageUrl: string;
  budgetLabel: string;
  fromPrice: number;
  nights: number;
  flightFrom: number;
  hotelFrom: number;
  airline: string;
  route: string;
  bestMonth: string;
  summary: string;
  whyCheap: string[];
  budgetTips: string[];
  mustTry: string[];
  caution: string;
}

/**
 * 예산별 추천 여행지.
 * 항공·숙소 저가 시세를 바탕으로 예산 구간을 나눈 큐레이션.
 */
export const MOCK_DEALS: DealPlace[] = [
  {
    id: "deal-danang",
    name: "다낭",
    country: "베트남",
    budgetLabel: "50만원대",
    budgetBand: 500000,
    fromPrice: 520000,
    nights: 4,
    flightFrom: 245000,
    hotelFrom: 118000,
    airline: "비엣젯 / 티웨이",
    route: "ICN → DAD",
    bestMonth: "4~5월",
    highlight: "항공 24만원대 포함",
    imageUrl:
      "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "deal-bangkok",
    name: "방콕",
    country: "태국",
    budgetLabel: "60만원대",
    budgetBand: 600000,
    fromPrice: 610000,
    nights: 4,
    flightFrom: 289000,
    hotelFrom: 142000,
    airline: "에어아시아 / 진에어",
    route: "ICN → BKK",
    bestMonth: "5~6월",
    highlight: "왕복 항공 28만원대",
    imageUrl:
      "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "deal-osaka",
    name: "오사카",
    country: "일본",
    budgetLabel: "70만원대",
    budgetBand: 700000,
    fromPrice: 720000,
    nights: 3,
    flightFrom: 268000,
    hotelFrom: 215000,
    airline: "피치 / 제주항공",
    route: "GMP → KIX",
    bestMonth: "2~3월",
    highlight: "김포-간사이 저가 노선",
    imageUrl:
      "https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "deal-taipei",
    name: "타이베이",
    country: "대만",
    budgetLabel: "80만원대",
    budgetBand: 800000,
    fromPrice: 790000,
    nights: 3,
    flightFrom: 252000,
    hotelFrom: 168000,
    airline: "티웨이 / 에어서울",
    route: "ICN → TPE",
    bestMonth: "1~2월",
    highlight: "왕복 항공 25만원대",
    imageUrl:
      "https://images.unsplash.com/photo-1598935898639-81586f7d2129?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "deal-fukuoka",
    name: "후쿠오카",
    country: "일본",
    budgetLabel: "90만원대",
    budgetBand: 900000,
    fromPrice: 880000,
    nights: 3,
    flightFrom: 315000,
    hotelFrom: 236000,
    airline: "제주항공 / 진에어",
    route: "ICN → FUK",
    bestMonth: "11~12월",
    highlight: "주말 포함 2박3일 단기 코스 인기",
    imageUrl:
      "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "deal-cebu",
    name: "세부",
    country: "필리핀",
    budgetLabel: "100만원대",
    budgetBand: 1_000_000,
    fromPrice: 980000,
    nights: 4,
    flightFrom: 355000,
    hotelFrom: 254000,
    airline: "세부퍼시픽 / 에어부산",
    route: "ICN → CEB",
    bestMonth: "1~3월",
    highlight: "리조트+호핑 포함해도 100만원 내외",
    imageUrl:
      "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80",
  },
];

/** @deprecated RecommendedPlace 호환용 별칭 */
export type RecommendedPlace = DealPlace;
export const MOCK_RECOMMENDED = MOCK_DEALS;

export function getDealById(id: string): DealPlace | undefined {
  return MOCK_DEALS.find((deal) => deal.id === id);
}

export function buildLocalDealDetail(deal: DealPlace): DealDetail {
  const flightMan = Math.round(deal.flightFrom / 10000);
  const hotelMan = Math.round(deal.hotelFrom / 10000);

  return {
    id: deal.id,
    name: deal.name,
    country: deal.country,
    imageUrl: deal.imageUrl,
    budgetLabel: deal.budgetLabel,
    fromPrice: deal.fromPrice,
    nights: deal.nights,
    flightFrom: deal.flightFrom,
    hotelFrom: deal.hotelFrom,
    airline: deal.airline,
    route: deal.route,
    bestMonth: deal.bestMonth,
    summary: `${deal.country} ${deal.name}은 ${deal.budgetLabel} 예산에 맞춰, 실제 저가 항공(${deal.route} ${flightMan}만원대)·숙소(${hotelMan}만원대) 시세를 반영한 추천이에요. ${deal.highlight}.`,
    whyCheap: [
      `${deal.airline} ${deal.route} 노선이 ${deal.bestMonth}에 ${flightMan}만원대부터 자주 열려요.`,
      `${deal.nights}박 숙소 시세가 약 ${hotelMan}만원대로, 총 예산 ${deal.budgetLabel} 안에 안정적으로 들어가요.`,
      "주중(화·수) 출발편을 고르면 항공비를 추가로 낮출 수 있어요.",
    ],
    budgetTips: [
      "항공권을 먼저 확정한 뒤 남은 예산으로 숙소·식비를 나눠요.",
      "역세권·도심 외곽 호텔이 관광지 핵심보다 1박당 2~4만원 저렴한 경우가 많아요.",
      "현지 교통 패스/합스 이동으로 교통비를 줄이면 식비 여유가 생겨요.",
    ],
    mustTry: [
      `${deal.name} 대표 야시장·맛집 골목`,
      "시내 핵심 명소 반나절 코스",
      "일몰 스팟 + 카페 휴식",
    ],
    caution:
      "표시 가격은 AI가 수집한 항공·숙소 저가 시세 기반 예상가이며, 실제 예약가는 날짜·좌석·시즌에 따라 달라질 수 있어요.",
  };
}
