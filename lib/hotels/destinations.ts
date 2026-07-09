export const HOTEL_DESTINATION_SUGGESTIONS = [
  "도쿄 · 시부야",
  "도쿄 · 아사쿠사",
  "오사카",
  "서울",
  "부산",
  "제주",
  "방콕",
  "싱가포르",
  "파리",
] as const;

export function normalizeHotelDestination(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}
