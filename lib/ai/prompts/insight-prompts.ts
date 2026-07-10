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

const WEATHER_SYSTEM_PROMPT =
  "여행 월 평균 기후와 제공된 데이터만 근거로 대비 안내를 작성한다. 단기 예보가 아닌 경우 해당 월의 전형적 기후를 설명한다. JSON만 출력.";

export function getWeatherSystemPrompt(): string {
  return WEATHER_SYSTEM_PROMPT;
}

export function buildWeatherPrompt(params: {
  destination: string;
  country: string;
  dateLabel: string;
  startDate: string;
  endDate: string;
  month: number;
  days: Array<{
    label: string;
    description: string;
    minC: number;
    maxC: number;
    source: string;
  }>;
  monthCaution: string;
}): string {
  const dayLines = params.days
    .map(
      (day) =>
        `- ${day.label}: ${day.description}, ${day.minC}°~${day.maxC}° (${day.source === "forecast" ? "단기 예보" : `${params.month}월 평균 기후`})`
    )
    .join("\n");

  const usesClimate = params.days.some((day) => day.source !== "forecast");

  return `당신은 Met U의 여행 날씨 어시스턴트입니다.
아래 데이터를 근거로 여행 기간 날씨 대비 안내를 작성하세요.

[여행]
- 목적지: ${params.destination}${params.country ? `, ${params.country}` : ""}
- 기간: ${params.startDate} ~ ${params.endDate} (${params.dateLabel})
- 여행 월: ${params.month}월

[예측 방식]
${
  usesClimate
    ? `- 단기 예보 범위(16일) 밖 여행이므로 **${params.month}월 평균 기후(최근 5년)** 로 예측했어요.
- 일별 수치는 해당 월·일자의 역사 평균 기온·강수 패턴이에요.
- ${params.month}월에 흔한 날씨(장마·혹서·건기 등)를 중심으로 추론하세요.`
    : "- 단기 예보 데이터를 사용했어요."
}

[일별 날씨]
${dayLines}

[${params.month}월 여행 주의]
${params.monthCaution}

출력(JSON만):
{"summary":"2~3문장 종합 예측·대비 요약","preparation":["대비 팁1","대비 팁2","대비 팁3"]}

규칙:
- summary: ${params.month}월 기후 특성 + 기온·강수 중심, 친근한 한국어
- preparation: 해당 월에 맞는 실행 가능한 준비물·옷차림 3~4개
- 데이터에 없는 날씨는 추측하지 말 것`;
}
