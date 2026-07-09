import { NextResponse } from "next/server";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";
import {
  buildLocalDealDetail,
  getDealById,
  type DealDetail,
} from "@/lib/deals/data";

async function enrichViaBackend(detail: DealDetail): Promise<DealDetail> {
  const prompt = `너는 한국어 예산 여행 큐레이터야. 저가 항공·숙소 시세를 바탕으로 아래 여행지를 설명해. JSON만 반환해.
도시: ${detail.name}
국가: ${detail.country}
예산구간: ${detail.budgetLabel}
예상총액(1인): ${detail.fromPrice}
박수: ${detail.nights}
항공사/노선: ${detail.airline} / ${detail.route}
항공최저(왕복): ${detail.flightFrom}
숙소최저(총액): ${detail.hotelFrom}
추천시기: ${detail.bestMonth}

JSON 스키마:
{
  "summary": "예산구간과 항공·숙소 저가 근거를 포함한 2문장 요약",
  "whyCheap": ["항공 저가 근거","숙소 시세 근거","시기/요일 근거"],
  "budgetTips": ["팁1","팁2","팁3"],
  "mustTry": ["할거리1","할거리2","할거리3"],
  "caution": "실제 예약가 변동 주의 한 문장"
}`;

  const system =
    "항공·숙소 저가 데이터를 근거로 예산별 추천을 짧고 실용적으로 설명해. JSON만 출력.";

  try {
    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ system, prompt, mode: "deal" }),
    });
    if (!res.ok) return detail;

    const data = (await res.json()) as { content?: string | null };
    if (!data.content) return detail;

    const parsed = JSON.parse(data.content) as Partial<DealDetail>;
    return {
      ...detail,
      summary: parsed.summary || detail.summary,
      whyCheap:
        Array.isArray(parsed.whyCheap) && parsed.whyCheap.length > 0
          ? parsed.whyCheap
          : detail.whyCheap,
      budgetTips:
        Array.isArray(parsed.budgetTips) && parsed.budgetTips.length > 0
          ? parsed.budgetTips
          : detail.budgetTips,
      mustTry:
        Array.isArray(parsed.mustTry) && parsed.mustTry.length > 0
          ? parsed.mustTry
          : detail.mustTry,
      caution: parsed.caution || detail.caution,
    };
  } catch (error) {
    if (error instanceof BackendUnavailableError || error instanceof SyntaxError) {
      return detail;
    }
    return detail;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deal = getDealById(id);
  if (!deal) {
    return NextResponse.json({ error: "deal-not-found" }, { status: 404 });
  }

  const local = buildLocalDealDetail(deal);
  const detail = await enrichViaBackend(local);
  return NextResponse.json(detail);
}
