/**
 * 확정 지출 ↔ 플랜 예산 배분 매칭.
 * 매칭은 안내용이며 예상 비용을 실제 지출로 올리지 않는다.
 */

export type PlanAlloc = {
  id: string;
  label: string;
  amount: number;
};

export type PlanMatch = {
  allocId: string;
  allocLabel: string;
  planAmountKrw: number;
  /** 실제 − 예상 (양수면 실제가 더 큼) */
  deltaKrw: number;
};

const CATEGORY_HINTS: Record<string, RegExp> = {
  숙소: /숙소|호텔|호텔|에어비앤비|hostel|hotel|airbnb/i,
  교통: /교통|항공|비행|기차|버스|지하철|택시|flight|airline|열차/i,
  식비: /식비|음식|식당|카페|meal|food|restaurant/i,
  관광: /관광|입장|티켓|투어|sight|museum/i,
  쇼핑: /쇼핑|면세|souvenir|shop/i,
};

export function matchExpenseToPlan(args: {
  category: string;
  label?: string;
  merchant?: string;
  krwAmount: number;
  allocation: ReadonlyArray<PlanAlloc>;
}): PlanMatch | null {
  if (args.allocation.length === 0) return null;
  const hay = `${args.category} ${args.merchant ?? ""} ${args.label ?? ""}`;
  const cat = args.category.trim();

  let best: PlanAlloc | null = null;
  for (const a of args.allocation) {
    if (a.label === cat || hay.includes(a.label)) {
      best = a;
      break;
    }
  }
  if (!best) {
    const hint = CATEGORY_HINTS[cat];
    if (hint) {
      best =
        args.allocation.find((a) => hint.test(a.label) || hint.test(cat)) ??
        null;
    }
  }
  if (!best && (cat === "숙소" || cat === "교통")) {
    const hint = CATEGORY_HINTS[cat];
    best =
      args.allocation.find((a) => (hint ? hint.test(a.label) : false)) ?? null;
  }
  if (!best) return null;

  return {
    allocId: best.id,
    allocLabel: best.label,
    planAmountKrw: Math.trunc(best.amount),
    deltaKrw: Math.trunc(args.krwAmount) - Math.trunc(best.amount),
  };
}

/** 항공·숙소 계열인지 (알림/지출 UI 배지용). */
export function isTravelBigTicket(category: string, label = ""): boolean {
  const t = `${category} ${label}`;
  return /숙소|호텔|항공|비행|flight|hotel/i.test(t);
}
