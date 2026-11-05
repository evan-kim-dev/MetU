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
  source: "ai+rag" | "cache" | "rag" | "empty";
  hit: "fresh" | "stale" | "miss";
};

/** RAG cheapPlaces → 국가 추정. 가격 숫자 없음. */
const PLACE_COUNTRY: Record<string, string> = {
  런던: "영국",
  파리: "프랑스",
  오사카: "일본",
  방콕: "태국",
  프라하: "체코",
  도쿄: "일본",
  제주: "한국",
  타이베이: "대만",
  교토: "일본",
  부산: "한국",
  다낭: "베트남",
  홍콩: "홍콩",
  후쿠오카: "일본",
  발리: "인도네시아",
  오키나와: "일본",
  홋카이도: "일본",
  삿포로: "일본",
  "파리(비수기 초입)": "프랑스",
};

/**
 * AI/캐시가 비었을 때 시즌 RAG 큐레이션으로 채운다.
 * 가짜 가격·항공료를 만들지 않고, monthDeals 후보만 DealPlace 로 옮긴다.
 */
export function ragFallbackDeals(now = Date.now()): DealPlace[] {
  const { month } = kstMonthYear(now);
  const tip = getMonthDealTip(month);
  const rows = tip.cheapPlaces.map((name) => {
    const clean = name.replace(/\(.*?\)/g, "").trim() || name.trim();
    return {
      name: clean,
      country: PLACE_COUNTRY[name] ?? PLACE_COUNTRY[clean] ?? "해외",
      bestMonth: `${month}월`,
      highlight: tip.dealReason.slice(0, 120),
      tier: "가성비",
    };
  });
  return toDealPlaces(rows);
}

type CachedDealsPayload = { places: DealPlace[] };

/** KST calendar YYYY-MM-DD */
function kstYmd(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dealsCacheKey(now = Date.now()): string {
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
      const rag = ragFallbackDeals();
      if (rag.length === 0) {
        return { places: [], source: "empty", hit: cached.hit };
      }
      return { places: rag, source: "rag", hit: cached.hit };
    }
    return {
      places,
      source: cached.hit === "miss" ? "ai+rag" : "cache",
      hit: cached.hit,
    };
  } catch (error) {
    console.error("[recommended-deals]", error);
    const rag = ragFallbackDeals();
    if (rag.length === 0) {
      return { places: [], source: "empty", hit: "miss" };
    }
    return { places: rag, source: "rag", hit: "miss" };
  }
}
