import { aiChatOrNull } from "@/lib/ai/chat-client";
import { parseDealsOut } from "@/lib/ai/contracts";
import {
  buildRecommendedDealsPrompt,
  getDealsSystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";
import {
  dealIdFromName,
  normalizeDealTierLabel,
  type DealPlace,
} from "@/lib/deals/data";
import { getMonthDealTip } from "@/lib/rag/monthDeals";
import { getOrSet } from "@/lib/server/cache";
import { resolveDestinationImage } from "@/lib/trips/destination-image";

const CACHE_TTL_SEC = 24 * 60 * 60;
const TARGET_COUNT = 6;

export type CuratedDealsResult = {
  places: DealPlace[];
  source: "ai+rag" | "cache" | "empty";
  hit: "fresh" | "stale" | "miss";
};

type CachedDealsPayload = { places: DealPlace[] };

/** KST calendar YYYY-MM-DD */
export function kstYmd(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dealsCacheKey(now = Date.now()): string {
  return `deals:v1:${kstYmd(now)}`;
}

function kstMonthYear(now = Date.now()): { month: number; year: number } {
  const ymd = kstYmd(now);
  const [y, m] = ymd.split("-").map((v) => Number(v));
  return { year: y || new Date(now).getFullYear(), month: m || 1 };
}

function toDealPlaces(
  rows: {
    name: string;
    country: string;
    bestMonth: string;
    highlight: string;
    tier: string;
  }[]
): DealPlace[] {
  const used = new Set<string>();
  const places: DealPlace[] = [];

  for (const row of rows) {
    if (places.length >= TARGET_COUNT) break;
    const name = row.name.trim();
    const country = row.country.trim();
    if (!name || !country) continue;

    let id = dealIdFromName(name);
    if (used.has(id)) {
      id = `${id}-${places.length + 1}`;
    }
    used.add(id);

    places.push({
      id,
      name,
      country,
      budgetLabel: normalizeDealTierLabel(row.tier),
      bestMonth: row.bestMonth.trim().slice(0, 40) || `${kstMonthYear().month}월`,
      highlight: row.highlight.trim().slice(0, 120),
      imageUrl: resolveDestinationImage(name, country),
    });
  }

  return places;
}

/**
 * Gemini 로 6곳 생성. 실패·형식 불일치 시 throw → getOrSet staleIfError 용.
 */
async function generateDeals(): Promise<CachedDealsPayload> {
  const { month, year } = kstMonthYear();
  const tip = getMonthDealTip(month);
  const ragContexts = [
    tip.dealReason,
    tip.caution,
    `이번 달 가성비 후보: ${tip.cheapPlaces.join(", ")}`,
  ];

  const prompt = buildRecommendedDealsPrompt({
    month,
    year,
    ragContexts,
  });

  const chat = await aiChatOrNull({
    mode: "deals",
    system: getDealsSystemPrompt(),
    prompt,
  });
  if (!chat) {
    throw new Error("deals-ai-unavailable");
  }

  const parsed = parseDealsOut(chat.content);
  if (!parsed) {
    throw new Error("deals-parse-failed");
  }

  const places = toDealPlaces(parsed.deals);
  if (places.length === 0) {
    throw new Error("deals-empty");
  }

  return { places };
}

/**
 * 이번 달 시즌 RAG + LLM으로 홈 추천 여행지 생성.
 * 캐시 키 `deals:v1:YYYY-MM-DD`(KST), TTL 24h, staleIfError.
 * 키/실패 + 캐시 없음 → 빈 목록.
 */
export async function curateRecommendedDeals(): Promise<CuratedDealsResult> {
  const key = dealsCacheKey();

  try {
    const cached = await getOrSet(key, CACHE_TTL_SEC, generateDeals, {
      staleIfError: true,
    });
    const places = Array.isArray(cached.value?.places)
      ? cached.value.places
      : [];
    if (places.length === 0) {
      return { places: [], source: "empty", hit: cached.hit };
    }
    return {
      places,
      source: cached.hit === "miss" ? "ai+rag" : "cache",
      hit: cached.hit,
    };
  } catch (error) {
    console.error("[recommended-deals]", error);
    return { places: [], source: "empty", hit: "miss" };
  }
}
