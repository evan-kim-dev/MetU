import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";
import {
  buildRecommendedDealsPrompt,
  getDealsSystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";
import { MOCK_DEALS, type DealPlace } from "@/lib/deals/data";
import { getMonthDealTip } from "@/lib/rag/monthDeals";

type AiDealRow = {
  id?: string;
  highlight?: string;
};

function monthAwareFallback(month: number): DealPlace[] {
  const tip = getMonthDealTip(month);
  const cheap = new Set(tip.cheapPlaces.map((p) => p.replace(/\(.*\)/g, "").trim()));

  const scored = MOCK_DEALS.map((deal, index) => {
    let score = MOCK_DEALS.length - index;
    if (cheap.has(deal.name)) score += 20;
    if (tip.cheapPlaces.some((p) => p.includes(deal.name) || deal.name.includes(p))) {
      score += 10;
    }
    return { deal, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map(({ deal }) => ({
      ...deal,
      highlight:
        cheap.has(deal.name) ||
        tip.cheapPlaces.some((p) => p.includes(deal.name))
          ? `${month}월 시즌 가성비 후보`
          : deal.highlight,
    }));
}

function applyAiOrder(
  base: DealPlace[],
  rows: AiDealRow[]
): DealPlace[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const byId = new Map(base.map((deal) => [deal.id, deal]));
  const used = new Set<string>();
  const next: DealPlace[] = [];

  for (const row of rows) {
    const id = row.id?.trim();
    if (!id || used.has(id) || !byId.has(id)) continue;
    const deal = byId.get(id)!;
    used.add(id);
    next.push({
      ...deal,
      highlight:
        typeof row.highlight === "string" && row.highlight.trim()
          ? row.highlight.trim().slice(0, 120)
          : deal.highlight,
    });
  }

  // AI가 일부만 주면 나머지도 뒤에 붙임
  for (const deal of base) {
    if (!used.has(deal.id)) next.push(deal);
  }

  return next.length > 0 ? next : null;
}

/**
 * 이번 달 시즌 RAG + LLM으로 홈 추천 여행지를 큐레이션.
 * AI 실패 시에도 MOCK_DEALS 기반 시즌 폴백을 반환.
 */
export async function curateRecommendedDeals(): Promise<{
  places: DealPlace[];
  source: "ai+rag" | "fallback";
}> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const tip = getMonthDealTip(month);
  const fallback = monthAwareFallback(month);

  const ragContexts = [
    tip.dealReason,
    tip.caution,
    `이번 달 가성비 후보: ${tip.cheapPlaces.join(", ")}`,
  ];

  try {
    const prompt = buildRecommendedDealsPrompt({
      month,
      year,
      candidates: MOCK_DEALS.map((deal) => ({
        id: deal.id,
        name: deal.name,
        country: deal.country,
        budgetLabel: deal.budgetLabel,
        bestMonth: deal.bestMonth,
        highlight: deal.highlight,
      })),
      ragContexts,
    });

    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        system: getDealsSystemPrompt(),
        prompt,
        mode: "deals",
      }),
    });

    if (!res.ok) {
      return { places: fallback, source: "fallback" };
    }

    const data = (await res.json()) as { content?: string | null };
    const content = data.content?.trim();
    if (!content) {
      return { places: fallback, source: "fallback" };
    }

    const parsed = JSON.parse(content) as { deals?: AiDealRow[] };
    const ordered = applyAiOrder(MOCK_DEALS, parsed.deals ?? []);
    if (!ordered) {
      return { places: fallback, source: "fallback" };
    }

    return { places: ordered, source: "ai+rag" };
  } catch (error) {
    if (
      error instanceof BackendUnavailableError ||
      error instanceof SyntaxError
    ) {
      return { places: fallback, source: "fallback" };
    }
    console.error("[recommended-deals]", error);
    return { places: fallback, source: "fallback" };
  }
}
