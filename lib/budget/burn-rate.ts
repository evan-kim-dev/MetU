/**
 * 일일 가용 경비(페이스메이커) 순수 계산.
 * 항공·숙소 고정비를 뺀 뒤 여행 일수×인원으로 나눈 안전 한도(정수 KRW).
 */
export function calcDailyBurnAllowance(params: {
  totalBudget: number;
  fixedCostKRW: number;
  days: number;
  people: number;
}): number {
  const days = Math.max(1, Math.floor(params.days));
  const people = Math.max(1, Math.floor(params.people));
  const discretionary = Math.max(
    0,
    Math.floor(params.totalBudget) - Math.max(0, Math.floor(params.fixedCostKRW))
  );
  return Math.floor(discretionary / (days * people));
}

/**
 * 실청구 환율(effectiveRate)로 원화 한도를 현지 통화 단위로 환산.
 * rateUnit: baseRate 가 가리키는 외화 단위 (엔은 보통 100).
 */
export function convertKrwToLocal(params: {
  amountKRW: number;
  effectiveRate: number;
  rateUnit?: number;
}): number {
  const unit = params.rateUnit ?? 1;
  if (!(params.effectiveRate > 0) || !(unit > 0)) return 0;
  return Math.floor((params.amountKRW / params.effectiveRate) * unit);
}
