import { NextResponse } from "next/server";
import { curateRecommendedDeals } from "@/lib/deals/recommend-deals";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 120;

/**
 * 홈 AI 추천 여행지.
 * 시즌 RAG + LLM 생성, 일 단위 캐시 (가짜 가격 없음).
 */
export async function GET(request: Request) {
  const guard = await guardApi(request, { bucket: "ai" });
  if (guard instanceof NextResponse) return guard;

  try {
    const { places, source, hit } = await curateRecommendedDeals();
    return NextResponse.json({ places, source, hit });
  } catch (error) {
    console.error("[api/recommended-deals]", error);
    return NextResponse.json(
      { places: [], source: "empty", error: "recommend-failed" },
      { status: 500 }
    );
  }
}
