import { retrieveBudgetRag } from "@/lib/rag/budgetBands";

const BUDGET_SYSTEM_PROMPT =
  "예산 RAG 밖 추천은 금지. 1인당/총예산 250만원 미만에서 유럽을 말하면 안 된다.";

export function getBudgetSystemPrompt(): string {
  return BUDGET_SYSTEM_PROMPT;
}

export function looksLikeFakeQuote(text: string): boolean {
  return (
    /(항공|숙소|호텔).{0,12}(\d{1,3}(,?\d{3})*|\d+)\s*만/.test(text) ||
    /항공권과 숙소/.test(text)
  );
}

export function buildBudgetPrompt(budget: number, month: number): string {
  const rag = retrieveBudgetRag(budget, month);
  return `당신은 Met U의 총 예산 단계 어시스턴트입니다.
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
}

export function buildPartyPrompt(
  budget: number,
  people: number,
  month: number
): string {
  const perPerson = people > 0 ? Math.floor(budget / people) : budget;
  const rag = retrieveBudgetRag(perPerson, month);
  const partyLabel =
    people === 1
      ? "1인(혼자)"
      : people === 2
        ? "2인(커플/친구)"
        : people === 3
          ? "3인"
          : `${people}인(단체/가족)`;

  return `당신은 "Met U"의 인원 단계 어시스턴트입니다.
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
}
