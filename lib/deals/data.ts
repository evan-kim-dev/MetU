/**
 * AI 시즌 추천 여행지 (가격 숫자 없음).
 * budgetLabel 은 가성비/보통/프리미엄 등급 문구만 사용한다.
 */
export interface DealPlace {
  id: string;
  name: string;
  country: string;
  /** 가성비 / 보통 / 프리미엄 */
  budgetLabel: string;
  imageUrl: string;
  bestMonth: string;
  highlight: string;
}

export const DEAL_TIER_LABELS = ["가성비", "보통", "프리미엄"] as const;
export type DealTierLabel = (typeof DEAL_TIER_LABELS)[number];

/** Gemini tier 값을 UI 등급 문구로 정규화. 숫자 가격을 만들지 않는다. */
export function normalizeDealTierLabel(raw: string | undefined | null): DealTierLabel {
  const t = (raw ?? "").trim().toLowerCase();
  if (
    t === "가성비" ||
    t === "value" ||
    t === "budget" ||
    t === "cheap" ||
    t === "low"
  ) {
    return "가성비";
  }
  if (
    t === "프리미엄" ||
    t === "premium" ||
    t === "luxury" ||
    t === "high"
  ) {
    return "프리미엄";
  }
  return "보통";
}

/** name 기반 slug → `deal-${slug}` */
export function dealIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `deal-${slug || "place"}`;
}
