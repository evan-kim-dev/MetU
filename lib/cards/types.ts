/**
 * 카드 혜택 기반 여행 지출 계획 — 공용 타입.
 * 원천: CODEF 개인카드 실적조회 API (result-check-list) 응답을 정규화한 값.
 */

/** 여행 지출 분류 (계획 단위). */
export const SPEND_CATEGORIES = [
  "flight",
  "lodging",
  "food",
  "transport",
  "shopping",
] as const;
export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

export const SPEND_CATEGORY_LABEL: Record<SpendCategory, string> = {
  flight: "항공",
  lodging: "숙박",
  food: "식비·카페",
  transport: "교통",
  shopping: "쇼핑·면세",
};

/** 혜택이 적용되는 범위. overseas = 해외 가맹점 결제 전반(현지 결제). */
export type BenefitScope = SpendCategory | "overseas";

export type ParsedBenefit = {
  /** CODEF resType (예: 청구할인) */
  type: string;
  /** CODEF resCardBenefitName 원문 */
  name: string;
  /** 퍼센트 할인/적립률 (0.1 = 10%) */
  rate: number | null;
  /** 건당 정액 할인 (원) */
  flatKrw: number | null;
  /** 월 한도 (원). 원문에 없으면 null = 한도 미상 */
  monthlyCapKrw: number | null;
  /** 할인인지 적립(포인트·캐시백)인지 */
  kind: "discount" | "reward";
  scopes: BenefitScope[];
  /** 규칙으로 금액·범위를 모두 읽었으면 parsed, 아니면 사람이 확인 */
  status: "parsed" | "needs-review";
};

export type CardPerformance = {
  currentKrw: number | null;
  requiredKrw: number | null;
  standardKrw: number | null;
  met: boolean | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export type CardSnapshot = {
  /** 화면 키 (카드번호 끝 4자리 + 카드명 기반) */
  id: string;
  name: string;
  company: string | null;
  /** 카드번호는 끝 4자리만 보관 */
  last4: string | null;
  performance: CardPerformance;
  benefits: ParsedBenefit[];
};

export type SpendBudget = Partial<Record<SpendCategory, number>>;

export type CategoryPlan = {
  category: SpendCategory;
  budgetKrw: number;
  cardId: string | null;
  benefitName: string | null;
  discountKrw: number;
  /** 카드 실적이 아직 부족해서 혜택이 조건부인지 */
  conditional: boolean;
  /** 계산 근거 한 줄 */
  note: string;
};

export type CardPlanSummary = {
  cardId: string;
  assignedSpendKrw: number;
  /** 아직 부족한 실적 (원). 충족이거나 미상이면 0 */
  shortfallKrw: number;
  /** 이번 여행 결제만으로 실적을 채울 수 있는지 */
  fillsShortfall: boolean;
};

export type SpendPlan = {
  categories: CategoryPlan[];
  cards: CardPlanSummary[];
  confirmedDiscountKrw: number;
  conditionalDiscountKrw: number;
};
