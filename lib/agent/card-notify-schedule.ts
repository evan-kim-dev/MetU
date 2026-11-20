/**
 * 카드 알림(확정 지출) 반영 후 남은 예산으로 남은 일정 조정안을 만들어요.
 * 일정 JSON 은 직접 쓰지 않아요 — Suggestion payload 전용 (수락 시 accept 경로).
 *
 * 금액은 정수 KRW. LLM 없음.
 */

import {
  buildRebalanceProposal,
  type RebalanceProposal,
} from "@/lib/agent/rebalance-agent";
import { FIXED_BUDGET_CATEGORIES } from "@/lib/budget/types";
import type {
  BudgetCategoryId,
  BudgetPlan,
  ConfirmedExpenseView,
  PlanItem,
} from "@/lib/budget/types";

const FIXED = new Set<BudgetCategoryId>(FIXED_BUDGET_CATEGORIES);

export type CardNotifyDrop = {
  day: number;
  time: string;
  title: string;
  category: BudgetCategoryId;
  estCost: number;
};

export type CardNotifyLatest = {
  merchant?: string;
  krwAmount: number;
  category?: string;
};

export type CardNotifyScheduleProposal = RebalanceProposal & {
  /** 총예산 − 확정 지출 합 */
  remainingBudgetKrw: number;
  /** 조정 전 남은 일정 추정 합 */
  remainingScheduleEstKrw: number;
  /** 추정 합 − 남은 예산 (양수면 일정 쪽이 더 큼) */
  gapKrw: number;
  /** estCost 를 0 으로 둔 드롭 후보 (수락 시 비용 0 반영) */
  dropped: CardNotifyDrop[];
  source: "card-notify";
};

function truncNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function sumEst(items: ReadonlyArray<PlanItem>): number {
  return items.reduce((s, i) => s + truncNonNeg(i.estCost), 0);
}

function sumExpenses(expenses: ReadonlyArray<ConfirmedExpenseView>): number {
  return expenses.reduce((s, e) => s + truncNonNeg(e.krwAmount), 0);
}

function fmtWon(n: number): string {
  return `${truncNonNeg(n).toLocaleString("ko-KR")}원`;
}

function isSoft(item: PlanItem): boolean {
  return !FIXED.has(item.category);
}

/**
 * 남은 예산보다 일정 추정이 크면, 나중 day·큰 금액 soft 항목부터 estCost=0 (드롭).
 * flight/stay 는 건드리지 않아요.
 */
export function dropSoftItemsToFitBudget(args: {
  items: ReadonlyArray<PlanItem>;
  remainingBudgetKrw: number;
}): { items: PlanItem[]; dropped: CardNotifyDrop[]; log: string[] } {
  const cap = truncNonNeg(args.remainingBudgetKrw);
  const items = args.items.map((i) => ({ ...i, estCost: truncNonNeg(i.estCost) }));
  const dropped: CardNotifyDrop[] = [];
  const log: string[] = [];

  let total = sumEst(items);
  if (total <= cap) {
    return { items, dropped, log };
  }

  const softIdx = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => isSoft(item) && item.estCost > 0)
    .sort((a, b) => {
      if (b.item.day !== a.item.day) return b.item.day - a.item.day;
      if (b.item.estCost !== a.item.estCost) return b.item.estCost - a.item.estCost;
      return b.item.time.localeCompare(a.item.time);
    });

  for (const { item, idx } of softIdx) {
    if (total <= cap) break;
    const cost = items[idx]!.estCost;
    items[idx] = { ...items[idx]!, estCost: 0 };
    total -= cost;
    dropped.push({
      day: item.day,
      time: item.time,
      title: item.title,
      category: item.category,
      estCost: cost,
    });
    log.push(
      `Day${item.day} ${item.time} ${item.title}: 일정에서 빼는 안 (−${fmtWon(cost)})`
    );
  }

  return { items, dropped, log };
}

/**
 * 카드 확정 지출 기준: 카테고리 감축(기존 rebalance) + 남은 총예산에 맞춘 드롭.
 */
export function proposeScheduleAfterCardNotify(args: {
  plan: BudgetPlan;
  expenses: ReadonlyArray<ConfirmedExpenseView>;
  remainingItems: ReadonlyArray<PlanItem>;
  latestCard?: CardNotifyLatest;
  threshold?: number;
}): CardNotifyScheduleProposal {
  const remainingBudgetKrw = Math.max(
    0,
    truncNonNeg(args.plan.total) - sumExpenses(args.expenses)
  );
  const remainingScheduleEstKrw = sumEst(args.remainingItems);
  const gapKrw = remainingScheduleEstKrw - remainingBudgetKrw;

  // 총예산 잔여 기준으로 soft 항목을 먼저 드롭한 뒤, 카테고리 감축안을 얹어요.
  const fitted = dropSoftItemsToFitBudget({
    items: args.remainingItems,
    remainingBudgetKrw,
  });

  const base = buildRebalanceProposal({
    plan: args.plan,
    expenses: args.expenses,
    remainingItems: fitted.items,
    threshold: args.threshold,
  });

  const dropped = fitted.dropped;
  const adjustmentsLog = [...fitted.log, ...base.adjustmentsLog];
  const stillOver = sumEst(base.adjustedItems) > remainingBudgetKrw;
  const shouldSuggest =
    base.shouldSuggest ||
    dropped.length > 0 ||
    (gapKrw > 0 && adjustmentsLog.length > 0);

  const cardBit = args.latestCard
    ? args.latestCard.merchant?.trim()
      ? `「${args.latestCard.merchant.trim().slice(0, 40)}」 ${fmtWon(args.latestCard.krwAmount)} 카드 결제 뒤, `
      : `카드 ${fmtWon(args.latestCard.krwAmount)} 결제 뒤, `
    : "";

  let message: string;
  if (!shouldSuggest) {
    message = `${cardBit}남은 예산 ${fmtWon(remainingBudgetKrw)} 안에 일정이 들어가요.`;
  } else if (dropped.length > 0) {
    message = `${cardBit}남은 예산이 ${fmtWon(remainingBudgetKrw)}이에요. 일정 ${dropped.length}개를 빼거나 줄이는 안을 확인해요.`;
  } else if (base.shouldSuggest) {
    message = `${cardBit}${base.message} 남은 예산은 ${fmtWon(remainingBudgetKrw)}이에요.`;
  } else if (stillOver) {
    message = `${cardBit}남은 예산 ${fmtWon(remainingBudgetKrw)}보다 일정 추정이 커요. 고정비 외엔 더 줄일 항목이 없어요.`;
  } else {
    message = base.message;
  }

  return {
    ...base,
    shouldSuggest,
    adjustedItems: base.adjustedItems,
    adjustmentsLog,
    remainingBudgetKrw,
    remainingScheduleEstKrw,
    gapKrw,
    dropped,
    message,
    source: "card-notify",
  };
}
