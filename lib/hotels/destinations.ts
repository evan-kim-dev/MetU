export const HOTEL_DESTINATION_SUGGESTIONS = [
  // 한국
  "서울",
  "부산",
  "제주",
  // 일본
  "도쿄 · 시부야",
  "도쿄 · 아사쿠사",
  "오사카",
  // 동남아
  "방콕",
  "싱가포르",
  "하노이",
  "다낭",
  "마닐라",
  "쿠알라룸푸르",
  "발리",
  // 중화권
  "홍콩",
  "타이베이",
  "상하이",
  "베이징",
  // 유럽
  "파리",
  "런던",
  "로마",
  "바르셀로나",
  "암스테르담",
  // 미주·중동
  "뉴욕",
  "로스앤젤레스",
  "두바이",
] as const;

export function normalizeHotelDestination(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}
