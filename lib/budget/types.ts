/**
 * 예산 중심 도메인 타입.
 * 금액은 항상 정수 KRW. LLM/클라이언트는 이 값들을 확정 계산하지 않는다.
 */

export type BudgetCategoryId =
  | "flight"
  | "stay"
  | "food"
  | "transport"
  | "etc";

/** 고정비(일일 변동 예산에서 제외) */
export const FIXED_BUDGET_CATEGORIES: ReadonlyArray<BudgetCategoryId> = [
  "flight",
  "stay",
] as const;

/** 변동비(dailyAllowance 분모) */
export const VARIABLE_BUDGET_CATEGORIES: ReadonlyArray<BudgetCategoryId> = [
  "food",
  "transport",
  "etc",
] as const;

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategoryId, string> = {
  flight: "항공·이동",
  stay: "숙소",
  food: "식비",
  transport: "교통",
  etc: "관광·기타",
};

export type BudgetCategoryLimit = {
  limit: number;
};

export type BudgetPlan = {
  tripId: string;
  total: number;
  perPerson: number;
  categories: Record<BudgetCategoryId, BudgetCategoryLimit>;
  version: number;
};

export type PlanItemCategory = BudgetCategoryId;

export type PlanItem = {
  tripId: string;
  day: number;
  time: string;
  title: string;
  category: PlanItemCategory;
  estCost: number;
};

export type SuggestionType = "record" | "rebalance" | "settle";
export type SuggestionStatus = "open" | "accepted" | "dismissed";

export type Suggestion = {
  id: string;
  tripId: string;
  type: SuggestionType;
  payload: Record<string, unknown>;
  status: SuggestionStatus;
  createdAt: string;
};

/** 엔진 입력용 확정 지출 뷰 (confirmed만) */
export type ConfirmedExpenseView = {
  category: BudgetCategoryId | string;
  krwAmount: number;
  /** YYYY-MM-DD */
  occurredOn?: string | null;
  paidBy?: string;
  splitWith?: string[];
};

export type SettlementTransfer = {
  from: string;
  to: string;
  amount: number;
};

export type Settlement = {
  tripId: string;
  transfers: SettlementTransfer[];
};

export type CategoryVariance = {
  category: BudgetCategoryId;
  planLimit: number;
  actual: number;
  delta: number;
  /** actual / planLimit (한도 0이면 actual>0 → Infinity 대신 큰 수 대신 overRatio=null) */
  overRatio: number | null;
};
