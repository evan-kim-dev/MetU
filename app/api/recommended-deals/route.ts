import { NextResponse } from "next/server";
import { curateRecommendedDeals } from "@/lib/deals/recommend-deals";

export const maxDuration = 120;

/**
 * 홈 AI 추천 여행지.
 * 시즌 RAG + LLM으로 후보를 정렬·하이라이트 갱신.
 */
export async function GET() {
  try {
    const { places, source } = await curateRecommendedDeals();
    return NextResponse.json({ places, source });
  } catch (error) {
    console.error("[api/recommended-deals]", error);
    return NextResponse.json(
      { places: [], source: "error", error: "recommend-failed" },
      { status: 500 }
    );
  }
}
