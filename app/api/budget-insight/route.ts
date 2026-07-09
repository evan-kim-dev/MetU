import { NextResponse } from "next/server";
import { buildLocalBudgetInsight } from "@/lib/ai/budget-insight";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";
import {
  retrieveBudgetRag,
  violatesBudgetBand,
} from "@/lib/rag/budgetBands";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const budget = Number(searchParams.get("budget") ?? "0");

  if (!Number.isFinite(budget) || budget < 0) {
    return NextResponse.json({ error: "invalid-budget" }, { status: 400 });
  }

  const fallback = buildLocalBudgetInsight(budget);
  const month = new Date().getMonth() + 1;
  const rag = retrieveBudgetRag(budget, month);

  if (budget <= 0) {
    return NextResponse.json({ insight: fallback, source: "local" });
  }

  const prompt = `당신은 BudgetTrip AI의 총 예산 단계 어시스턴트입니다.
인원수는 아직 모릅니다. RAG으로 권역만 추천하세요.

총 예산: ${budget.toLocaleString("ko-KR")}원
(아래 RAG는 "이 돈을 1명이 쓸 때" 기준입니다. 인원이 늘면 1인당 예산이 줄어듭니다.)

[RAG]
${rag.contexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

[허용 권역]
${rag.allowedRegions.join(", ")}

톤 1~2문장:
"총 예산 ○○이면(1인 기준) ~~한 여행이 가능하고, ~~를 추천해요. 인원이 늘면 1인당 예산이 줄어들어요."

금지: 허용 목록 밖(특히 250만 미만에서 유럽), 항공·숙소 임의 견적, JSON.`;

  const system =
    "예산 RAG 밖 추천은 금지. 1인당/총예산 250만원 미만에서 유럽을 말하면 안 된다.";

  try {
    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ system, prompt, mode: "budget" }),
    });

    if (!res.ok) {
      return NextResponse.json({ insight: fallback, source: "fallback" });
    }

    const data = (await res.json()) as {
      content?: string | null;
      source?: string;
    };
    const content = data.content?.trim();
    if (
      !content ||
      looksLikeFakeQuote(content) ||
      violatesBudgetBand(content, budget)
    ) {
      return NextResponse.json({ insight: fallback, source: "fallback" });
    }

    return NextResponse.json({
      insight: content,
      source: data.source === "ai" ? "ai+rag" : "fallback",
    });
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json({ insight: fallback, source: "fallback" });
    }
    return NextResponse.json({ insight: fallback, source: "fallback" });
  }
}

function looksLikeFakeQuote(text: string): boolean {
  return (
    /(항공|숙소|호텔).{0,12}(\d{1,3}(,?\d{3})*|\d+)\s*만/.test(text) ||
    /항공권과 숙소/.test(text)
  );
}
