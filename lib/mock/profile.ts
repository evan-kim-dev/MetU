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

/** Early-access 중립 기본값 (데모 인물/소개 없음) */
export const MOCK_PROFILE: ProfileUser = {
  name: "여행자",
  email: "",
  avatarUrl: "",
  membershipLabel: "회원",
  styles: [],
  bio: "",
  homeCity: "",
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
