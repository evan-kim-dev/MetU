import { NextResponse } from "next/server";
import { curateRecommendedDeals } from "@/lib/deals/recommend-deals";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 120;

/** CDN/브라우저: 1시간 신선, 하루 stale 허용 (서버 api_cache TTL 과 별개). */
const CACHE_HEADER =
  "public, s-maxage=3600, stale-while-revalidate=86400";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/**
 * 홈 AI 추천 여행지 — 퍼블릭 조회.
 * 로그인·게스트 세션 불필요. IP 레이트리밋만 적용.
 * 시즌 RAG + LLM(캐시) · 비면 RAG 큐레이션 폴백. 가짜 가격 없음.
 */
export async function GET(request: Request) {
  const rate = checkRateLimit(`recommended-deals:${clientIp(request)}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { places: [], source: "empty", error: "rate-limit-exceeded" },
      {
        status: 429,
        headers: rate.retryAfterSec
          ? { "Retry-After": String(rate.retryAfterSec) }
          : undefined,
      }
    );
  }

  try {
    const { places, source, hit } = await curateRecommendedDeals();
    return NextResponse.json(
      { places, source, hit },
      {
        status: 200,
        headers: { "Cache-Control": CACHE_HEADER },
      }
    );
  } catch (error) {
    console.error("[api/recommended-deals]", error);
    // 홈이 깨지지 않도록 빈 목록 200 (클라이언트는 SSR 폴백 유지).
    return NextResponse.json(
      { places: [], source: "empty", hit: "miss", error: "recommend-failed" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
