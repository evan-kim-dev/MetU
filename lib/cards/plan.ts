import {
  SPEND_CATEGORIES,
  SPEND_CATEGORY_LABEL,
  type CardSnapshot,
  type CategoryPlan,
  type ParsedBenefit,
  type SpendBudget,
  type SpendCategory,
  type SpendPlan,
} from "./types";

/**
 * 여행 예산(분류별)을 어떤 카드로 내면 할인이 가장 큰지 계산해요.
 * - 금액은 모두 원 단위 정수, 내림.
 * - 월 한도는 혜택마다 남은 한도를 추적해서 두 분류가 한 한도를 같이 쓰지 않게 해요.
 * - 정액 혜택은 결제 횟수를 모르니 1회로만 계산해요(보수적).
 * - 실적이 부족한 카드의 혜택은 "조건부"로 따로 합산해요.
 * - 해외(overseas) 혜택은 현지에서 결제하는 식비·교통·쇼핑에 적용해요.
 */

const OVERSEAS_APPLIES_TO: SpendCategory[] = ["food", "transport", "shopping"];

function applies(b: ParsedBenefit, category: SpendCategory): boolean {
  if (b.status !== "parsed") return false;
  if (b.scopes.includes(category)) return true;
  return b.scopes.includes("overseas") && OVERSEAS_APPLIES_TO.includes(category);
}

function rawDiscount(b: ParsedBenefit, budget: number): number {
  if (budget <= 0) return 0;
  if (b.rate != null) return Math.floor(budget * b.rate);
  if (b.flatKrw != null) return Math.min(b.flatKrw, budget);
  return 0;
}

function benefitKey(cardId: string, idx: number): string {
  return `${cardId}#${idx}`;
}

type Candidate = {
  category: SpendCategory;
  cardId: string;
  benefitIdx: number;
  benefit: ParsedBenefit;
  potential: number;
};

export function planCardSpend(cards: CardSnapshot[], budget: SpendBudget): SpendPlan {
  const budgets = SPEND_CATEGORIES.map((c) => ({
    category: c,
    amount: Math.max(0, Math.floor(budget[c] ?? 0)),
  }));

  const candidates: Candidate[] = [];
  for (const card of cards) {
    card.benefits.forEach((b, idx) => {
      for (const { category, amount } of budgets) {
        if (amount <= 0 || !applies(b, category)) continue;
        const potential = rawDiscount(b, amount);
        if (potential > 0) {
          candidates.push({ category, cardId: card.id, benefitIdx: idx, benefit: b, potential });
        }
      }
    });
  }
  // 할인 큰 순, 같으면 실적 충족 카드 우선, 그다음 카드 id 순(결정적)
  const metOf = new Map(cards.map((c) => [c.id, c.performance.met === true]));
  candidates.sort(
    (a, b) =>
      b.potential - a.potential ||
      Number(metOf.get(b.cardId)) - Number(metOf.get(a.cardId)) ||
      (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : a.benefitIdx - b.benefitIdx)
  );

  const capLeft = new Map<string, number | null>();
  const chosen = new Map<SpendCategory, { c: Candidate; discount: number }>();
  for (const c of candidates) {
    if (chosen.has(c.category)) continue;
    const key = benefitKey(c.cardId, c.benefitIdx);
    if (!capLeft.has(key)) capLeft.set(key, c.benefit.monthlyCapKrw);
    const left = capLeft.get(key);
    const discount = left == null ? c.potential : Math.min(c.potential, left);
    if (discount <= 0) continue;
    chosen.set(c.category, { c, discount });
    if (left != null) capLeft.set(key, left - discount);
  }

  const categories: CategoryPlan[] = budgets.map(({ category, amount }) => {
    const pick = chosen.get(category);
    if (!pick) {
      return {
        category,
        budgetKrw: amount,
        cardId: null,
        benefitName: null,
        discountKrw: 0,
        conditional: false,
        note: amount > 0 ? "적용되는 혜택이 없어요" : "예산 없음",
      };
    }
    const { c, discount } = pick;
    const conditional = metOf.get(c.cardId) !== true;
    const how =
      c.benefit.rate != null
        ? `${SPEND_CATEGORY_LABEL[category]} ${amount.toLocaleString("ko-KR")}원 × ${+(c.benefit.rate * 100).toFixed(2)}%`
        : `정액 ${c.benefit.flatKrw?.toLocaleString("ko-KR")}원 1회 기준`;
    const capped = discount < c.potential ? " · 월 한도까지만" : "";
    return {
      category,
      budgetKrw: amount,
      cardId: c.cardId,
      benefitName: c.benefit.name,
      discountKrw: discount,
      conditional,
      note: `${how}${capped}`,
    };
  });

  const assigned = new Map<string, number>();
  for (const p of categories) {
    if (p.cardId) assigned.set(p.cardId, (assigned.get(p.cardId) ?? 0) + p.budgetKrw);
  }
  const cardSummaries = cards.map((card) => {
    const spend = assigned.get(card.id) ?? 0;
    const shortfall =
      card.performance.met === false ? Math.max(0, card.performance.requiredKrw ?? 0) : 0;
    return {
      cardId: card.id,
      assignedSpendKrw: spend,
      shortfallKrw: shortfall,
      fillsShortfall: shortfall > 0 && spend >= shortfall,
    };
  });

  let confirmed = 0;
  let conditional = 0;
  for (const p of categories) {
    if (p.conditional) conditional += p.discountKrw;
    else confirmed += p.discountKrw;
  }
  return {
    categories,
    cards: cardSummaries,
    confirmedDiscountKrw: confirmed,
    conditionalDiscountKrw: conditional,
  };
}
