import {
  BUDGET_CATEGORY_LABELS,
  type BudgetCategoryId,
  type BudgetCategoryLimit,
  type BudgetPlan,
} from "@/lib/budget/types";

export type AllocateInput = {
  total: number;
  travelers: number;
  nights: number;
  destination?: string;
};

export type AllocateWeights = Record<BudgetCategoryId, number>;

/**
 * 기본 가중치 (합=1). generate-plan 계열과 맞춘 출발점.
 * VERIFY: 목적지·인원·박수에 따른 조정은 휴리스틱 예시.
 */
export function baseAllocateWeights(args: {
  travelers: number;
  nights: number;
  destination?: string;
}): AllocateWeights {
  const weights: AllocateWeights = {
    flight: 0.28,
    stay: 0.3,
    food: 0.2,
    transport: 0.1,
    etc: 0.12,
  };

  const people = Math.max(1, Math.trunc(args.travelers) || 1);
  const nights = Math.max(1, Math.trunc(args.nights) || 1);

  // 인원이 늘면 항공·숙소 비중↑, 변동↓
  if (people >= 3) {
    weights.flight += 0.03;
    weights.stay += 0.02;
    weights.food -= 0.03;
    weights.etc -= 0.02;
  }

  // 장기 체류면 숙소·식비↑, 항공↓
  if (nights >= 5) {
    weights.stay += 0.04;
    weights.food += 0.02;
    weights.flight -= 0.04;
    weights.transport -= 0.02;
  }

  const dest = (args.destination ?? "").toLowerCase();
  // 국내(제주 등)는 항공 비중을 낮추는 휴리스틱
  if (/제주|부산|강릉|여수|국내/.test(dest) || dest.includes("korea")) {
    weights.flight -= 0.08;
    weights.transport += 0.04;
    weights.stay += 0.02;
    weights.food += 0.02;
  }

  return normalizeWeights(weights);
}

function normalizeWeights(w: AllocateWeights): AllocateWeights {
  const ids = Object.keys(w) as BudgetCategoryId[];
  const sum = ids.reduce((s, id) => s + Math.max(0, w[id]), 0);
  if (!(sum > 0)) {
    return { flight: 0.28, stay: 0.3, food: 0.2, transport: 0.1, etc: 0.12 };
  }
  const next = { ...w };
  for (const id of ids) {
    next[id] = Math.max(0, w[id]) / sum;
  }
  // 반올림 오차 보정은 allocate 금액 단계에서
  return next;
}

/**
 * 총예산을 카테고리 한도로 나눈다. 합은 total과 같게 largest-remainder.
 */
export function allocate(input: AllocateInput): BudgetPlan {
  const total = Math.max(0, Math.trunc(input.total) || 0);
  const travelers = Math.max(1, Math.trunc(input.travelers) || 1);
  const nights = Math.max(1, Math.trunc(input.nights) || 1);
  const weights = baseAllocateWeights({
    travelers,
    nights,
    destination: input.destination,
  });

  const order: BudgetCategoryId[] = [
    "flight",
    "stay",
    "food",
    "transport",
    "etc",
  ];

  const rows = order.map((id) => {
    const exact = total * weights[id];
    const floor = Math.floor(exact);
    return { id, floor, rem: exact - floor };
  });
  const used = rows.reduce((s, r) => s + r.floor, 0);
  let left = total - used;
  const byRem = [...rows].sort((a, b) => {
    if (b.rem !== a.rem) return b.rem - a.rem;
    return a.id < b.id ? -1 : 1;
  });
  const limits: Record<BudgetCategoryId, number> = {
    flight: 0,
    stay: 0,
    food: 0,
    transport: 0,
    etc: 0,
  };
  for (const r of rows) limits[r.id] = r.floor;
  for (let i = 0; i < byRem.length && left > 0; i++) {
    limits[byRem[i]!.id] += 1;
    left -= 1;
  }

  const categories = {} as Record<BudgetCategoryId, BudgetCategoryLimit>;
  for (const id of order) {
    categories[id] = { limit: limits[id]! };
  }

  return {
    tripId: "",
    total,
    perPerson: Math.floor(total / travelers),
    categories,
    version: 1,
  };
}

/** UI 바/범례용 세그먼트 */
export function planToSegments(plan: BudgetPlan): Array<{
  id: BudgetCategoryId;
  label: string;
  percent: number;
  amount: number;
}> {
  const total = Math.max(0, plan.total);
  const order: BudgetCategoryId[] = [
    "flight",
    "stay",
    "food",
    "transport",
    "etc",
  ];
  return order.map((id) => {
    const amount = plan.categories[id]?.limit ?? 0;
    const percent =
      total > 0 ? Math.round((amount / total) * 100) : 0;
    return {
      id,
      label: BUDGET_CATEGORY_LABELS[id],
      percent,
      amount,
    };
  });
}
