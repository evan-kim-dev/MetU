import type { Trip } from "./types";

/** Early-access: 데모 여행 없음 */
export const INITIAL_TRIPS: Trip[] = [];

export const STYLE_LABELS: Record<string, string> = {
  healing: "힐링",
  sightseeing: "관광",
  food: "맛집",
  shopping: "쇼핑",
  activity: "액티비티",
  culture: "문화·예술",
  nature: "자연",
  hotplace: "핫플",
};
