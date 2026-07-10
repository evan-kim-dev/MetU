export const CHECKLIST_CATEGORIES = [
  {
    id: "flight",
    label: "항공",
    description: "항공권 예약·확인·탑승 관련 준비 항목",
  },
  {
    id: "hotel",
    label: "숙박",
    description: "숙소 예약·체크인·숙박 관련 준비 항목",
  },
  {
    id: "docs",
    label: "서류",
    description: "여권·비자·보험 등 필수 서류 체크",
  },
  {
    id: "weather",
    label: "날씨",
    description: "여행지 현재 날씨와 주간 예보 확인",
  },
] as const;

export type ChecklistCategoryId = (typeof CHECKLIST_CATEGORIES)[number]["id"];

export function getChecklistCategory(id: string) {
  return CHECKLIST_CATEGORIES.find((item) => item.id === id);
}
