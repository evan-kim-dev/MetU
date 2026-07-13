import type { BudgetAllocation } from "@/lib/ai/types";

/** 총예산 대비 항공·숙소 상한 (밴드) */
export const FLIGHT_BUDGET_RATIO = 0.45;
export const HOTEL_BUDGET_RATIO = 0.4;

const FLEXIBLE_IDS = new Set(["food", "transport", "activity"]);

export function flightBudgetCap(totalBudget: number): number {
  return Math.max(0, Math.round(totalBudget * FLIGHT_BUDGET_RATIO));
}

export function hotelBudgetCap(totalBudget: number): number {
  return Math.max(0, Math.round(totalBudget * HOTEL_BUDGET_RATIO));
}

/**
 * 예산 밴드 안 최저가 우선. 없으면 전체 최저가 + withinBand=false.
 */
export function pickCheapestInBand<T>(
  items: T[],
  getPrice: (item: T) => number,
  maxPrice: number
): { item: T; price: number; withinBand: boolean } | null {
  const priced = items
    .map((item) => ({ item, price: getPrice(item) }))
    .filter((row) => Number.isFinite(row.price) && row.price > 0);

  if (priced.length === 0) return null;

  const inBand = priced.filter((row) => row.price <= maxPrice);
  const pool = inBand.length > 0 ? inBand : priced;
  const best = pool.reduce((a, b) => (a.price <= b.price ? a : b));

  return {
    item: best.item,
    price: best.price,
    withinBand: best.price <= maxPrice,
  };
}

/**
 * live 항공·숙소 가격을 고정하고, 남는 예산을 식비·교통·관광에 비율 재배분.
 */
export function reallocateBudgetWithLiveQuotes(
  allocation: BudgetAllocation[],
  totalBudget: number,
  flightPrice: number,
  hotelPrice: number
): { items: BudgetAllocation[]; remaining: number; overBudget: boolean } {
  const flight = Math.max(0, Math.round(flightPrice));
  const hotel = Math.max(0, Math.round(hotelPrice));
  const remaining = Math.round(totalBudget) - flight - hotel;
  const overBudget = remaining < 0;

  const flexible = allocation.filter((item) => FLEXIBLE_IDS.has(item.id));
  const flexibleWeightSum =
    flexible.reduce((sum, item) => sum + Math.max(0, item.amount), 0) || 1;

  const flexiblePool = overBudget ? 0 : remaining;

  const next = allocation.map((item) => {
    if (item.id === "flight") {
      return { ...item, amount: flight };
    }
    if (item.id === "hotel") {
      return { ...item, amount: hotel };
    }
    if (FLEXIBLE_IDS.has(item.id)) {
      const share = Math.max(0, item.amount) / flexibleWeightSum;
      return {
        ...item,
        amount: Math.round(flexiblePool * share),
      };
    }
    return item;
  });

  // 반올림 잔차 보정 (flexible 합 = remaining)
  if (!overBudget && flexible.length > 0) {
    const flexSum = next
      .filter((item) => FLEXIBLE_IDS.has(item.id))
      .reduce((sum, item) => sum + item.amount, 0);
    const drift = remaining - flexSum;
    if (drift !== 0) {
      const anchor = next.find((item) => item.id === "food") ?? next.find((item) =>
        FLEXIBLE_IDS.has(item.id)
      );
      if (anchor) {
        anchor.amount = Math.max(0, anchor.amount + drift);
      }
    }
  }

  const denom = Math.max(
    totalBudget,
    next.reduce((sum, item) => sum + item.amount, 0),
    1
  );

  const withPercent = next.map((item) => ({
    ...item,
    percent: Math.max(0, Math.round((item.amount / denom) * 100)),
  }));

  // percent 합 100 근처로 맞춤
  const percentSum = withPercent.reduce((sum, item) => sum + item.percent, 0);
  if (percentSum !== 100 && withPercent.length > 0) {
    const largest = withPercent.reduce((a, b) =>
      a.amount >= b.amount ? a : b
    );
    largest.percent = Math.max(0, largest.percent + (100 - percentSum));
  }

  return { items: withPercent, remaining, overBudget };
}
