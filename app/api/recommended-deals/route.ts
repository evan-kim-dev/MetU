import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend/client";
import {
  buildRecommendedDealsPrompt,
  getDealsSystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";
import { MOCK_DEALS, type DealPlace } from "@/lib/deals/data";
import { getMonthDealTip } from "@/lib/rag/monthDeals";

type CuratedDeal = { id?: string; highlight?: string };

function applyAiCuration(
  base: DealPlace[],
  curated: CuratedDeal[]
): DealPlace[] {
  const byId = new Map(base.map((deal) => [deal.id, deal]));
  const used = new Set<string>();
  const ordered: DealPlace[] = [];

  for (const item of curated) {
    const id = item.id?.trim();
    if (!id || used.has(id) || !byId.has(id)) continue;
    const deal = byId.get(id)!;
    ordered.push({
      ...deal,
      highlight: item.highlight?.trim() || deal.highlight,
    });
    used.add(id);
  }

  for (const deal of base) {
    if (!used.has(deal.id)) ordered.push(deal);
  }

  return ordered;
}

export async function GET() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const tip = getMonthDealTip(month);
  const fallback = MOCK_DEALS;

  try {
    const prompt = buildRecommendedDealsPrompt({
      month,
      year,
      candidates: fallback.map((deal) => ({
        id: deal.id,
        name: deal.name,
        country: deal.country,
        budgetLabel: deal.budgetLabel,
        bestMonth: deal.bestMonth,
        highlight: deal.highlight,
      })),
      ragContexts: [
        `${month}월 가성비 권역: ${tip.cheapPlaces.join(", ")}`,
        tip.dealReason,
        tip.caution,
      ],
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
      return NextResponse.json({ places: fallback, source: "fallback" });
    }

    const data = (await res.json()) as {
      content?: string | null;
      source?: string;
    };
    if (!data.content || data.source !== "ai") {
      return NextResponse.json({ places: fallback, source: "fallback" });
    }

    const parsed = JSON.parse(data.content) as { deals?: CuratedDeal[] };
    if (!Array.isArray(parsed.deals) || parsed.deals.length === 0) {
      return NextResponse.json({ places: fallback, source: "fallback" });
    }

    return NextResponse.json({
      places: applyAiCuration(fallback, parsed.deals),
      source: "ai+rag",
    });
  } catch {
    return NextResponse.json({ places: fallback, source: "fallback" });
  }
}
