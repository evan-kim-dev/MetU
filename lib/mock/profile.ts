import type { TravelStyle } from "@/components/onboarding/types";

export interface ProfileUser {
  name: string;
  email: string;
  avatarUrl: string;
  /** 사용자가 직접 업로드한 프로필 사진 (data URL) */
  customAvatarUrl?: string | null;
  membershipLabel: string;
  styles: TravelStyle[];
  /** 한 줄 소개 */
  bio?: string;
  /** 자주 출발하는 도시 */
  homeCity?: string;
}

export const MOCK_PROFILE: ProfileUser = {
  name: "지훈",
  email: "traveler@budgettrip.ai",
  avatarUrl:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
  membershipLabel: "골드 멤버",
  styles: ["healing", "sightseeing", "food", "shopping"],
  bio: "예산 안에서 최대한 즐기는 여행을 좋아해요.",
  homeCity: "서울",
};

export const PROFILE_STYLE_OPTIONS: {
  value: TravelStyle;
  label: string;
  emoji: string;
}[] = [
  { value: "healing", label: "힐링", emoji: "🌿" },
  { value: "sightseeing", label: "관광", emoji: "📸" },
  { value: "food", label: "맛집", emoji: "🍜" },
  { value: "shopping", label: "쇼핑", emoji: "🛍️" },
];

export const CURRENCY_OPTIONS = ["KRW", "USD", "JPY", "EUR"] as const;
