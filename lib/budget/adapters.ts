import { allocate, planToSegments } from "@/lib/budget/engine/allocate";
import { normalizeBudgetCategory } from "@/lib/budget/engine/dailyAllowance";
import type {
  BudgetCategoryId,
  BudgetPlan,
  PlanItem,
} from "@/lib/budget/types";

type LegacyAlloc = {
  id: string;
  label: string;
  amount: number;
  percent?: number;
};

type LegacyDay = {
  day: number;
  items: Array<{
    time: string;
    title: string;
    cost: number;
    category?: string;
  }>;
};

/**
 * 레거시 budgetAllocation jsonb → BudgetPlan.
 * id hotel→stay, activity→etc.
 */
export function budgetPlanFromAllocation(args: {
  tripId: string;
  total: number;
  people: number;
  allocation: ReadonlyArray<LegacyAlloc>;
  version?: number;
}): BudgetPlan {
  const categories: BudgetPlan["categories"] = {
    flight: { limit: 0 },
    stay: { limit: 0 },
    food: { limit: 0 },
    transport: { limit: 0 },
    etc: { limit: 0 },
  };

  for (const a of args.allocation) {
    const id = mapLegacyAllocId(a.id);
    categories[id].limit += Math.max(0, Math.trunc(a.amount) || 0);
  }

  const total = Math.max(0, Math.trunc(args.total) || 0);
  const people = Math.max(1, Math.trunc(args.people) || 1);

  // allocation 비어 있으면 allocate로 채움
  const filled = Object.values(categories).some((c) => c.limit > 0);
  if (!filled && total > 0) {
    return {
      ...allocate({
        total,
        travelers: people,
        nights: 3,
      }),
      tripId: args.tripId,
      version: args.version ?? 1,
    };
  }

  return {
    tripId: args.tripId,
    total,
    perPerson: Math.floor(total / people),
    categories,
    version: args.version ?? 1,
  };
}

function mapLegacyAllocId(id: string): BudgetCategoryId {
  const t = id.toLowerCase();
  if (t === "hotel" || t === "stay") return "stay";
  if (t === "activity" || t === "shopping") return "etc";
  const n = normalizeBudgetCategory(t);
  return n ?? "etc";
}

export function planItemsFromDailySchedule(args: {
  tripId: string;
  dailySchedule: ReadonlyArray<LegacyDay>;
}): PlanItem[] {
  const out: PlanItem[] = [];
  for (const day of args.dailySchedule) {
    for (const item of day.items) {
      out.push({
        tripId: args.tripId,
        day: day.day,
        time: item.time,
        title: item.title,
        category: normalizeBudgetCategory(item.category ?? "etc") ?? "etc",
        estCost: Math.max(0, Math.trunc(item.cost) || 0),
      });
    }
  }
  return out;
}

/** 온보딩 표시용 — allocate 단일 소스 */
export function displaySegmentsFromTotal(totalKrw: number) {
  const plan = allocate({
    total: totalKrw,
    travelers: 2,
    nights: 3,
  });
  return planToSegments(plan);
}
