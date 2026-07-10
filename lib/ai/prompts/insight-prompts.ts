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
${rag.allowedRegions.length > 0 ? rag.allowedRegions.join(", ") : "(없음 — 목적지 추천 금지, 예산 상향만 안내)"}

톤 1~2문장:
${
  rag.allowedRegions.length === 0
    ? `"총 예산 ○○이면(1인 기준) 숙박 여행이 어려워요. 최소 15만원대부터 국내 근교를 볼 수 있고, 인원이 늘면 1인당이 더 줄어들어요."`
    : `"총 예산 ○○이면(1인 기준) ~~한 여행이 가능하고, ~~를 추천해요. 인원이 늘면 1인당 예산이 줄어들어요."`
}

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
${rag.allowedRegions.length > 0 ? rag.allowedRegions.join(", ") : "(없음 — 목적지 추천 금지)"}

[출력]
1~2문장, 톤:
${
  rag.allowedRegions.length === 0
    ? `"${people}인이면 1인당 약 ○○원으로 숙박 여행이 어려워요. 총 예산을 올리거나 인원을 줄여보세요."`
    : `"${people}인이면 1인당 약 ○○원으로 ${rag.band.nights} ~~가 현실적이고, ${month}월에는 (허용 목록 중) ~~를 추천해요."`
}

포함: 인원 팁 한 줄${rag.allowedRegions.length === 0 ? " + 예산 상향 안내" : " + 허용 권역 추천"}.
금지: 유럽/장거리 등 허용 목록 밖 추천, 항공·숙소 임의 견적 금액, JSON/불릿.`;
}

const FACTBOMB_SYSTEM_PROMPT =
  "예산 RAG만 근거로 직설적인 팩트폭격 1~2문장을 쓴다. 허용 권역 밖 대안은 금지.";

export function getFactBombSystemPrompt(): string {
  return FACTBOMB_SYSTEM_PROMPT;
}

export function buildFactBombPrompt(params: {
  destination: string;
  country: string;
  perPerson: number;
  totalBudget: number;
  people: number;
  nights: number;
  month: number;
}): string {
  const rag = retrieveBudgetRag(params.perPerson, params.month);
  const label = params.country
    ? `${params.destination}, ${params.country}`
    : params.destination;

  return `당신은 Met U의 예산 현실 체크 AI입니다.
사용자가 예산에 비해 무리한 목적지를 골랐습니다. 아래 RAG만 근거로 팩트폭격 멘트를 쓰세요. 밈을 활용해도 좋아요.

[입력]
- 목적지: ${label}
- 총 예산: ${params.totalBudget.toLocaleString("ko-KR")}원
- 인원: ${params.people}명
- 1인당: 약 ${params.perPerson.toLocaleString("ko-KR")}원
- 일정: ${params.nights}박 ${params.nights + 1}일
- 여행 월: ${params.month}월

[RAG]
${rag.contexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

[허용 대안 권역 — 이 안에서만 언급]
${rag.allowedRegions.join(", ")}

[출력 규칙]
- 한국어 1~2문장만
- 직설·유머 OK, 욕설 금지
- 왜 무리인지(거리/항공/예산 구간) + 현실 대안(허용 권역 중 2~3곳) 포함
- 항공·숙소 임의 견적 금액 금지
- JSON/불릿/제목 금지`;
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

const TIPS_SYSTEM_PROMPT =
  "여행 RAG만 근거로 실용적인 AI Tip을 JSON으로 작성한다. 허위 시세·환율 단정 금지.";

export function getTipsSystemPrompt(): string {
  return TIPS_SYSTEM_PROMPT;
}

export function buildTripTipsPrompt(params: {
  destination: string;
  country: string;
  dateRange: string;
  dDay: number;
  budget: number;
  spent: number;
  people: number;
  styles: string[];
  ragContexts: string[];
}): string {
  const remaining = Math.max(params.budget - params.spent, 0);
  return `당신은 Met U의 여행 AI Tip 어시스턴트입니다.
아래 RAG와 여행 정보만 근거로 팁 4개를 만드세요.

[여행]
- 목적지: ${params.destination}${params.country ? `, ${params.country}` : ""}
- 일정: ${params.dateRange || "미정"}
- D-day: ${params.dDay}
- 인원: ${params.people}명
- 총예산: ${params.budget.toLocaleString("ko-KR")}원
- 사용액: ${params.spent.toLocaleString("ko-KR")}원
- 잔액: ${remaining.toLocaleString("ko-KR")}원
- 스타일: ${params.styles.join(", ") || "미선택"}

[RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

출력(JSON만):
{"tips":[{"emoji":"✈️","title":"짧은 제목","description":"1문장 실용 팁"}]}

규칙:
- tips 정확히 4개
- title 8자 내외, description 1문장
- 목적지·예산·스타일에 맞출 것
- 임의 항공/숙소 가격·환율 수치 단정 금지
- 한국어`;
}

const STYLE_SYSTEM_PROMPT =
  "선택한 여행 스타일과 RAG만 근거로 1문장 맞춤 안내를 쓴다.";

export function getStyleSystemPrompt(): string {
  return STYLE_SYSTEM_PROMPT;
}

export function buildStyleInsightPrompt(params: {
  styles: string[];
  styleLabels: string[];
  ragContexts: string[];
}): string {
  return `당신은 Met U 온보딩 스타일 단계 어시스턴트입니다.
사용자가 고른 여행 스타일을 반영해 일정 방향을 1문장으로 안내하세요.

[선택 스타일]
${params.styleLabels.join(", ")} (${params.styles.join(", ")})

[RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

출력:
- 한국어 1문장만
- "~를 반영해 ~~한 코스를 짜드릴게요" 톤
- JSON/불릿 금지`;
}

const SCHEDULE_SYSTEM_PROMPT =
  "출발지·일정·시즌 RAG만 근거로 일정 단계 안내를 2문장 이내로 쓴다. 허위 시세 단정 금지.";

export function getScheduleSystemPrompt(): string {
  return SCHEDULE_SYSTEM_PROMPT;
}

export function buildScheduleInsightPrompt(params: {
  origin: string;
  destination: string;
  dateType: "specific" | "flexible";
  startDate: string;
  endDate: string;
  flexibleYear: number;
  flexibleMonth: number;
  ragContexts: string[];
}): string {
  const scheduleLabel =
    params.dateType === "specific"
      ? `${params.startDate || "미정"} ~ ${params.endDate || "미정"}`
      : `${params.flexibleYear}년 ${params.flexibleMonth}월 (유연 일정)`;

  return `당신은 Met U 온보딩 일정 단계 어시스턴트입니다.
출발지·목적지·날짜를 반영해 지금 선택에 맞는 일정 조언을 하세요.

[입력]
- 출발지: ${params.origin || "미입력"}
- 목적지: ${params.destination || "미입력"}
- 일정 유형: ${params.dateType === "specific" ? "날짜 지정" : "언제든지(월 선택)"}
- 일정: ${scheduleLabel}

[시즌 RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

[출력]
- 한국어 1~2문장
- 출발지/목적지/시기가 있으면 반영
- 유연 일정이면 해당 월의 가성비·주의점 중심
- 날짜 지정이면 선택 기간 기준으로 예산·예약 팁 중심
- 항공·숙소 임의 견적 금액 금지
- JSON/불릿 금지`;
}

export function buildPlanTipsPrompt(params: {
  destination: string;
  country: string;
  nights: number;
  people: number;
  perPerson: number;
  styleLabels: string[];
  ragContexts: string[];
}): string {
  return `당신은 Met U 일정 결과 화면의 AI Tip 작성기입니다.
RAG만 근거로 실행 가능한 팁 3개를 만드세요.

[일정]
- 목적지: ${params.destination}${params.country ? `, ${params.country}` : ""}
- ${params.nights}박 ${params.nights + 1}일
- ${params.people}명 / 1인당 약 ${params.perPerson.toLocaleString("ko-KR")}원
- 스타일: ${params.styleLabels.join(", ")}

[RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

출력(JSON만):
{"tips":["팁1","팁2","팁3"]}

규칙:
- 각 팁 1문장, 한국어
- 항공·숙소 임의 견적 금액 금지`;
}

const PLAN_SYSTEM_PROMPT =
  "여행 RAG만 근거로 일정·항공·숙소 안내를 JSON으로 작성한다. 허위 시세 금액 단정 금지.";

export function getPlanSystemPrompt(): string {
  return PLAN_SYSTEM_PROMPT;
}

export function buildPlanItineraryPrompt(params: {
  origin: string;
  destination: string;
  country: string;
  nights: number;
  people: number;
  totalBudget: number;
  perPerson: number;
  dateRange: string;
  styleLabels: string[];
  flightBudget: number;
  hotelBudget: number;
  ragContexts: string[];
}): string {
  const days = params.nights + 1;
  return `당신은 Met U 여행 플래너입니다. 입력과 RAG만 근거로 맞춤 일정을 JSON으로 만드세요.

[입력]
- 출발: ${params.origin || "미입력"}
- 목적지: ${params.destination}${params.country ? `, ${params.country}` : ""}
- 일정: ${params.dateRange} (${params.nights}박 ${days}일)
- 인원: ${params.people}명
- 총예산: ${params.totalBudget.toLocaleString("ko-KR")}원 (1인 약 ${params.perPerson.toLocaleString("ko-KR")}원)
- 스타일: ${params.styleLabels.join(", ") || "자유"}
- 항공 배정 예산(참고): ${params.flightBudget.toLocaleString("ko-KR")}원
- 숙소 배정 예산(참고): ${params.hotelBudget.toLocaleString("ko-KR")}원

[RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

출력(JSON만):
{
  "summary": "2문장 일정 요약",
  "flight": {"airline":"항공사 또는 저비용 항공 추천","schedule":"가는 편 HH:MM · 오는 편 HH:MM","note":"예약 팁 1문장"},
  "hotel": {"name":"숙소 유형명","area":"추천 지역","note":"숙소 팁 1문장"},
  "dailySchedule":[
    {"day":1,"label":"데이 제목","items":[{"time":"14:00","title":"활동"}]}
  ],
  "tips":["팁1","팁2","팁3"]
}

규칙:
- dailySchedule은 정확히 ${days}일
- 각 day items 2~4개, time은 HH:MM
- 목적지·스타일·시즌을 반영한 구체적 장소/활동
- 항공·숙소 임의 견적 금액(원/%) 금지
- JSON만 출력`;
}

const SUMMARY_SYSTEM_PROMPT =
  "여행 입력과 RAG만 근거로 일정 요약 2문장을 쓴다. 허위 시세 단정 금지.";

export function getSummarySystemPrompt(): string {
  return SUMMARY_SYSTEM_PROMPT;
}

export function buildNormalPlanSummaryPrompt(params: {
  origin: string;
  destination: string;
  country: string;
  nights: number;
  people: number;
  totalBudget: number;
  perPerson: number;
  styleLabels: string[];
  ragContexts: string[];
}): string {
  return `당신은 Met U 일정 요약 어시스턴트입니다.
정상 예산 범위의 여행을 친근하게 2문장으로 요약하세요.

[입력]
- 출발: ${params.origin || "미입력"}
- 목적지: ${params.destination}${params.country ? `, ${params.country}` : ""}
- ${params.nights}박 ${params.nights + 1}일 / ${params.people}명
- 총예산 ${params.totalBudget.toLocaleString("ko-KR")}원 (1인 약 ${params.perPerson.toLocaleString("ko-KR")}원)
- 스타일: ${params.styleLabels.join(", ") || "자유"}

[RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

출력:
- 한국어 2문장
- 항공·숙소 임의 견적 금액 금지
- JSON/불릿 금지`;
}

const DEALS_SYSTEM_PROMPT =
  "시즌 RAG와 후보 목록만 근거로 이번 달 가성비 여행지를 JSON으로 큐레이션한다.";

export function getDealsSystemPrompt(): string {
  return DEALS_SYSTEM_PROMPT;
}

export function buildRecommendedDealsPrompt(params: {
  month: number;
  year: number;
  candidates: Array<{
    id: string;
    name: string;
    country: string;
    budgetLabel: string;
    bestMonth: string;
    highlight: string;
  }>;
  ragContexts: string[];
}): string {
  return `당신은 Met U 홈 화면의 예산 여행 큐레이터입니다.
지금(${params.year}년 ${params.month}월) 기준으로 후보 중 가성비 좋은 순으로 정렬하고 highlight를 갱신하세요.

[시즌 RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

[후보]
${params.candidates
  .map(
    (c, i) =>
      `${i + 1}. id=${c.id} | ${c.name}(${c.country}) | ${c.budgetLabel} | 추천시기 ${c.bestMonth} | 기존: ${c.highlight}`
  )
  .join("\n")}

출력(JSON만):
{"deals":[{"id":"deal-xxx","highlight":"이번 달 기준 한 줄 하이라이트"}]}

규칙:
- 후보 id만 사용, 전부 포함
- 시즌·가성비 좋은 순 정렬
- highlight는 한국어 18자 내외
- 허위 시세 단정 금지`;
}
