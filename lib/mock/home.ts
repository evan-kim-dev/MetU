export interface ActiveTrip {
  id: string;
  destination: string;
  country: string;
  dateRange: string;
  dDay: number;
  budget: number;
  spent: number;
  imageUrl: string;
}

export interface SmartTip {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

export type { DealPlace as RecommendedPlace } from "@/lib/deals/data";
export { MOCK_DEALS as MOCK_RECOMMENDED } from "@/lib/deals/data";

/** @deprecated 홈 인사는 ProfileProvider의 profile.name을 사용하세요 */
export const MOCK_USER = {
  name: "지훈",
};

/** 진행 중인 여행 (Active Trip Card) */
export const MOCK_ACTIVE_TRIP: ActiveTrip = {
  id: "trip-london",
  destination: "런던",
  country: "영국",
  dateRange: "8월 12일 - 8월 18일",
  dDay: 35,
  budget: 2400000,
  spent: 860000,
  imageUrl:
    "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
};

/** AI 스마트 팁 (수평 스크롤) */
export const MOCK_SMART_TIPS: SmartTip[] = [
  {
    id: "tip-1",
    emoji: "💷",
    title: "환율 팁",
    description: "지금 파운드 환율이 최근 3개월 중 가장 낮아요.",
  },
  {
    id: "tip-2",
    emoji: "🎫",
    title: "교통 패스",
    description: "오이스터 카드로 지하철비 40% 아낄 수 있어요.",
  },
  {
    id: "tip-3",
    emoji: "🍽️",
    title: "맛집 예약",
    description: "인기 레스토랑은 2주 전 예약이 필수예요.",
  },
  {
    id: "tip-4",
    emoji: "☔",
    title: "날씨 대비",
    description: "8월 런던은 오후 소나기가 잦으니 우산을 챙기세요.",
  },
];

/** 통화 포맷 헬퍼 */
export function formatKRW(value: number): string {
  return `₩${value.toLocaleString("ko-KR")}`;
}
