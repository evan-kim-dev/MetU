import { NextResponse } from "next/server";
import { buildLocalPartyInsight } from "@/lib/ai/party-insight";
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
  const people = Number(searchParams.get("people") ?? "1");
  const monthParam = Number(searchParams.get("month") ?? "0");
  const month =
    monthParam >= 1 && monthParam <= 12
      ? monthParam
      : new Date().getMonth() + 1;

  if (!Number.isFinite(budget) || budget < 0) {
    return NextResponse.json({ error: "invalid-budget" }, { status: 400 });
  }
  if (!Number.isFinite(people) || people < 1 || people > 20) {
    return NextResponse.json({ error: "invalid-people" }, { status: 400 });
  }

  const fallback = buildLocalPartyInsight(budget, people, month);
  const perPerson = people > 0 ? Math.floor(budget / people) : budget;
  const rag = retrieveBudgetRag(perPerson, month);

  if (budget <= 0) {
    return NextResponse.json({
      insight: fallback,
      source: "local",
      rag: rag.contexts,
    });
  }

  const partyLabel =
    people === 1
      ? "1인(혼자)"
      : people === 2
        ? "2인(커플/친구)"
        : people === 3
          ? "3인"
          : `${people}인(단체/가족)`;

  const prompt = `당신은 "BudgetTrip AI"의 인원 단계 어시스턴트입니다.
반드시 아래 RAG(예산 구간 지식)만 근거로 추천하세요. RAG에 없는 권역은 절대 추천 금지.

[입력]
- 총 예산: ${budget.toLocaleString("ko-KR")}원
- 인원: ${partyLabel}
- 1인당: 약 ${perPerson.toLocaleString("ko-KR")}원
- 월: ${month}월

[RAG]
${rag.contexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

[허용 도시/권역 — 이 안에서만 추천]
${rag.allowedRegions.join(", ")}

[출력]
1~2문장, 톤:
"${people}인이면 1인당 약 ○○원으로 ${rag.band.nights} ~~가 현실적이고, ${month}월에는 (허용 목록 중) ~~를 추천해요."

포함: 인원 팁 한 줄 + 허용 권역 추천.
금지: 유럽/장거리 등 허용 목록 밖 추천, 항공·숙소 임의 견적 금액, JSON/불릿.`;

  const system =
    "예산 RAG를 벗어나는 추천은 할루시네이션이다. 1인당 250만원 미만에서 유럽을 말하면 안 된다.";

  try {
    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ system, prompt, mode: "party" }),
    });

    if (!res.ok) {
      return NextResponse.json({
        insight: fallback,
        source: "fallback",
        rag: rag.contexts,
      });
    }

    const data = (await res.json()) as {
      content?: string | null;
      source?: string;
    };
    const content = data.content?.trim();

    if (
      !content ||
      looksLikeFakeQuote(content) ||
      violatesBudgetBand(content, perPerson)
    ) {
      return NextResponse.json({
        insight: fallback,
        source: "fallback",
        rag: rag.contexts,
      });
    }

    return NextResponse.json({
      insight: content,
      source: data.source === "ai" ? "ai+rag" : "fallback",
      rag: rag.contexts,
    });
  } catch (error) {
    if (!(error instanceof BackendUnavailableError)) {
      /* ignore */
    }
    return NextResponse.json({
      insight: fallback,
      source: "fallback",
      rag: rag.contexts,
    });
  }
}

function looksLikeFakeQuote(text: string): boolean {
  return (
    /(항공|숙소|호텔).{0,12}(\d{1,3}(,?\d{3})*|\d+)\s*만/.test(text) ||
    /항공권과 숙소/.test(text)
  );
}
