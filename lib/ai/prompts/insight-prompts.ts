import { retrieveBudgetRag } from "@/lib/rag/budgetBands";
import {
  AI_NO_FAKE_QUOTES,
  AI_QUALITY_FIRST,
  AI_VOICE,
} from "@/lib/ai/prompts/shared";

const BUDGET_SYSTEM_PROMPT = `${AI_VOICE} ${AI_QUALITY_FIRST} 예산 RAG 밖 추천은 금지. 1인당/총예산 250만원 미만에서 유럽을 말하면 안 돼요.`;

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
${AI_QUALITY_FIRST}

총 예산: ${budget.toLocaleString("ko-KR")}원
(아래 RAG는 "이 돈을 1명이 쓸 때" 기준입니다. 인원이 늘면 1인당 예산이 줄어듭니다.)

[RAG]
${rag.contexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

[허용 권역]
${rag.allowedRegions.length > 0 ? rag.allowedRegions.join(", ") : "(없음 — 목적지 추천 금지, 예산 상향만 안내)"}

톤 3~5문장:
${
  rag.allowedRegions.length === 0
    ? `"총 예산 ○○이면(1인 기준) 숙박 여행이 어려워요. 최소 15만원대부터 국내 근교를 볼 수 있고, 인원이 늘면 1인당이 더 줄어들어요. 현실적인 다음 예산 구간과 이유를 자세히 안내해요."`
    : `"총 예산 ○○이면(1인 기준) ~~한 여행이 가능하고, ~~를 추천해요. 왜 그 권역이 맞는지, 인원이 늘면 어떻게 달라지는지, ${month}월 시즌 주의점까지 구체적으로 알려줘요."`
}

금지: 허용 목록 밖(특히 250만 미만에서 유럽), ${AI_NO_FAKE_QUOTES}, JSON.
${AI_VOICE}`;
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
${AI_QUALITY_FIRST}

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
3~5문장, 톤:
${
  rag.allowedRegions.length === 0
    ? `"${people}인이면 1인당 약 ○○원으로 숙박 여행이 어려워요. 총 예산을 올리거나 인원을 줄여보세요. 현실적인 대안 예산대와 이유를 자세히 설명해요."`
    : `"${people}인이면 1인당 약 ○○원으로 ${rag.band.nights} ~~가 현실적이고, ${month}월에는 (허용 목록 중) ~~를 추천해요. 인원 구성에 맞는 숙소·동선 팁과 시즌 주의점도 넣어요."`
}

포함: 인원 팁${rag.allowedRegions.length === 0 ? " + 예산 상향 안내" : " + 허용 권역 추천 + 실행 팁"}를 풍부하게.
금지: 유럽/장거리 등 허용 목록 밖 추천, 항공·숙소 임의 견적 금액, JSON/불릿.
${AI_VOICE}`;
}

const FACTBOMB_SYSTEM_PROMPT = `${AI_VOICE} ${AI_QUALITY_FIRST} 예산 RAG만 근거로 직설·야유·디스가 강한 팩트폭격을 써요. 허용 권역 밖 대안은 금지.`;

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
사용자가 말도 안 되는 목적지이거나, 예산에 비해 무리한 목적지를 골랐습니다.
아래 RAG만 근거로 직설적이고 야유 섞인 팩트폭격 멘트를 쓰세요. 밈·디스 OK, 과격해도 좋아요.
${AI_QUALITY_FIRST}

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
${rag.allowedRegions.length > 0 ? rag.allowedRegions.join(", ") : "(없음 — 예산 상향만 안내)"}

[출력 규칙]
- 한국어 3~5문장
- ${AI_VOICE}
- 직설·야유·디스 OK (과격해도 됨), 심한 욕설·혐오 표현만 금지
- 목적지가 허구/검색 불가 장소면 "여행지가 아니에요"를 먼저 세게 짚고, 허용 권역 대안을 제시
- 예산 무리면 왜 무리인지(거리/항공/예산 구간)를 비꼬듯 분명히 + 현실 대안(허용 권역 중 2~3곳) + 다음 액션
- 항공·숙소 임의 견적 금액 금지
- JSON/불릿/제목 금지`;
}

const WEATHER_SYSTEM_PROMPT = `${AI_VOICE} ${AI_QUALITY_FIRST} 여행 월 평균 기후와 제공된 데이터만 근거로 풍부한 대비 안내를 작성해요. 단기 예보가 아니면 해당 월의 전형적 기후를 설명해요. JSON만 출력.`;

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
${AI_QUALITY_FIRST}

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
{"summary":"4~6문장 종합 예측·대비 요약","preparation":["대비 팁1","대비 팁2","대비 팁3","대비 팁4","대비 팁5","대비 팁6"]}

규칙:
- summary: ${params.month}월 기후 특성 + 기온·강수·옷차림·실내외 활동 팁을 풍부하게 (해요체)
- preparation: 해당 월에 맞는 실행 가능한 준비물·옷차림·동선 팁 5~6개, 각 항목은 1~2문장 (해요체)
- 데이터에 없는 날씨는 추측하지 말 것
- ${AI_VOICE}`;
}

const TIPS_SYSTEM_PROMPT = `${AI_VOICE} ${AI_QUALITY_FIRST} 여행 RAG만 근거로 실용적인 AI Tip을 JSON으로 작성해요. 허위 시세·환율 단정 금지.`;

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
아래 RAG와 여행 정보만 근거로 팁 8개를 만드세요.
${AI_QUALITY_FIRST}

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
{"tips":[{"emoji":"✈️","title":"짧은 제목","description":"2~3문장 실용 팁"}]}

규칙:
- tips 정확히 8개
- title 10자 내외, description 2~3문장 (해요체) — 이유와 실행 방법을 포함
- 예산·교통·식사·숙소·시즌·스타일·현지 매너·예약 타이밍을 골고루
- 목적지·예산·스타일에 맞출 것
- 임의 항공/숙소 가격·환율 수치 단정 금지
- ${AI_VOICE}`;
}

const STYLE_SYSTEM_PROMPT = `${AI_VOICE} ${AI_QUALITY_FIRST} 선택한 여행 스타일과 RAG만 근거로 풍부한 맞춤 안내를 써요.`;

export function getStyleSystemPrompt(): string {
  return STYLE_SYSTEM_PROMPT;
}

export function buildStyleInsightPrompt(params: {
  styles: string[];
  styleLabels: string[];
  ragContexts: string[];
}): string {
  return `당신은 Met U 온보딩 스타일 단계 어시스턴트입니다.
사용자가 고른 여행 스타일을 반영해 일정 방향을 풍부하게 안내하세요.
${AI_QUALITY_FIRST}

[선택 스타일]
${params.styleLabels.join(", ")} (${params.styles.join(", ")})

[RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

출력:
- 한국어 3~4문장
- 스타일별 동선·식사·휴식 포인트를 구체적으로
- "~를 반영해 ~~한 코스를 짜드릴게요" 톤으로 시작해도 좋아요
- JSON/불릿 금지
- ${AI_VOICE}`;
}

const SCHEDULE_SYSTEM_PROMPT = `${AI_VOICE} ${AI_QUALITY_FIRST} 출발지·일정·시즌·예산 RAG만 근거로, 언제·어디가 가성비인지와 추천지를 풍부하게 안내해요. 허위 시세 단정 금지.`;

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
  budget?: number;
  people?: number;
  ragContexts: string[];
}): string {
  const scheduleLabel =
    params.dateType === "specific"
      ? `${params.startDate || "미정"} ~ ${params.endDate || "미정"}`
      : `${params.flexibleYear}년 ${params.flexibleMonth}월 (유연 일정)`;
  const people = Math.max(1, params.people ?? 1);
  const budget = params.budget ?? 0;
  const perPerson = budget > 0 ? Math.floor(budget / people) : 0;

  return `당신은 Met U 온보딩 일정 단계 어시스턴트입니다.
사용자가 고른 출발지·목적지·시기를 보고, "언제 어디가 싸고 / 어디를 추천하는지"를 구체적으로 알려주세요.
${AI_QUALITY_FIRST}

[입력]
- 출발지: ${params.origin || "미입력"}
- 목적지: ${params.destination || "미입력(어디든지)"}
- 일정 유형: ${params.dateType === "specific" ? "날짜 지정" : "언제든지(월 선택)"}
- 일정: ${scheduleLabel}
- 총예산: ${budget > 0 ? `${budget.toLocaleString("ko-KR")}원` : "미입력"}
- 인원: ${people}명${perPerson > 0 ? ` (1인 약 ${perPerson.toLocaleString("ko-KR")}원)` : ""}

[시즌·예산 RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

[출력]
- 한국어 4~6문장
- 반드시 포함: (1) 해당 시기 가성비 좋은 도시/권역 3~4곳과 이유 (2) 시즌 주의점 (3) 예약 타이밍 팁
- 목적지가 있으면: 그 목적지가 이 시기에 괜찮은지 + 더 싸게 가려면 대안 2곳
- 목적지가 없으면: RAG 허용 권역·가성비 권역 안에서 추천
- 유연 일정이면 월 기준 시즌 딜 중심, 날짜 지정이면 선택 기간 예약 타이밍 팁 포함
- 항공·숙소 임의 견적 금액(원/%) 금지
- JSON/불릿 금지
- ${AI_VOICE}`;
}

const PLAN_SYSTEM_PROMPT = `${AI_VOICE} ${AI_QUALITY_FIRST} 목적지 웹 지식(CITY_SUMMARY·DESTINATION_ATTRACTIONS)과 RAG만 근거로 매우 풍부한 일정·항공·숙소 안내를 JSON으로 작성해요. 목록에 있는 실명 장소를 우선하고, 허위 시세 금액 단정은 금지. 모든 일정 item에 detail을 꼭 채워요.`;

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
  destinationSummary?: string;
  attractions?: Array<{ name: string; detail: string }>;
}): string {
  const days = params.nights + 1;
  const attractionBlock =
    params.attractions && params.attractions.length > 0
      ? params.attractions
          .map((a, i) => `${i + 1}. ${a.name} — ${a.detail}`)
          .join("\n")
      : "(없음 — 위키/지도 기반 명소를 최대한 실명으로 작성)";

  return `당신은 Met U 여행 플래너입니다. 입력·CITY_SUMMARY·DESTINATION_ATTRACTIONS·RAG만 근거로 매우 풍부하고 구체적인 맞춤 일정을 JSON으로 만드세요.
${AI_QUALITY_FIRST}
현지 장소·동선·식사·휴식·이동 시간·소요 팁까지 디테일하게 채워 주세요.

[입력]
- 출발: ${params.origin || "미입력"}
- 목적지: ${params.destination}${params.country ? `, ${params.country}` : ""}
- 일정: ${params.dateRange} (${params.nights}박 ${days}일)
- 인원: ${params.people}명
- 총예산: ${params.totalBudget.toLocaleString("ko-KR")}원 (1인 약 ${params.perPerson.toLocaleString("ko-KR")}원)
- 스타일: ${params.styleLabels.join(", ") || "자유"}
- 항공 배정 예산(참고): ${params.flightBudget.toLocaleString("ko-KR")}원
- 숙소 배정 예산(참고): ${params.hotelBudget.toLocaleString("ko-KR")}원

[CITY_SUMMARY]
${params.destinationSummary?.trim() || "(요약 없음)"}

[DESTINATION_ATTRACTIONS]
${attractionBlock}

[RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

출력(JSON만):
{
  "summary": "4~6문장 일정 요약 (분위기·하이라이트·동선·식사·휴식 포인트). ${params.nights}박 ${days}일을 정확히 반영",
  "flight": {"airline":"항공사 또는 저비용 항공 추천","schedule":"가는 편 HH:MM · 오는 편 HH:MM","note":"예약·환승·수하물·좌석 팁 2~3문장"},
  "hotel": {"name":"숙소 유형명","area":"추천 지역","note":"위치·조식·체크인·주변 동선 팁 2~3문장"},
  "dailySchedule":[
    {"day":1,"label":"데이 제목","items":[{"time":"14:00","title":"소제목 (이동·장소 한 줄)","detail":"구체적인 행동·소요·팁 한두 문장"}]}
  ],
  "tips":["팁1","팁2","팁3","팁4","팁5","팁6","팁7","팁8"]
}

규칙:
- dailySchedule은 정확히 ${days}일 (박수 ${params.nights} 반영)
- 각 day items 6~8개, time은 HH:MM
- title은 **짧은 소제목** (예: "지하철 → 하카타역", "오호리공원"). DESTINATION_ATTRACTIONS에 있는 실명을 우선 사용. 목록에 없는 유명 명소도 실제로 존재하는 이름만 허용
- "대표 명소", "로컬 레스토랑", "자유 시간", "시내 투어"처럼 장소가 특정되지 않은 막연한 title 금지
- **모든 item에 detail 필수**: 소요시간·가는 법·팁을 해요체 1~2문장
- 같은 날 장소는 지리적으로 가까운 순으로 배치 (불필요한 시내 왕복 최소화)
- 아침·점심·저녁·카페·이동·핵심 관광·야경/야시장을 균형 있게
- tips는 8개, 각각 실용적인 1~2문장 (해요체)
- 항공·숙소 임의 견적 금액(원/%) 금지
- summary·note·tips·detail 모두 해요체
- JSON만 출력
- ${AI_VOICE}`;
}

const SUMMARY_SYSTEM_PROMPT = `${AI_VOICE} ${AI_QUALITY_FIRST} 여행 입력과 RAG만 근거로 일정 요약을 풍부하게 써요. 허위 시세 단정 금지.`;

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
정상 예산 범위의 여행을 친근하고 구체적으로 요약하세요.
${AI_QUALITY_FIRST}
분위기, 핵심 동선, 스타일 반영, 식사·휴식 포인트를 넣으세요.

[입력]
- 출발: ${params.origin || "미입력"}
- 목적지: ${params.destination}${params.country ? `, ${params.country}` : ""}
- ${params.nights}박 ${params.nights + 1}일 / ${params.people}명
- 총예산 ${params.totalBudget.toLocaleString("ko-KR")}원 (1인 약 ${params.perPerson.toLocaleString("ko-KR")}원)
- 스타일: ${params.styleLabels.join(", ") || "자유"}

[RAG]
${params.ragContexts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

출력:
- 한국어 4~6문장
- 항공·숙소 임의 견적 금액 금지
- JSON/불릿 금지
- ${AI_VOICE}`;
}

const DEALS_SYSTEM_PROMPT = `${AI_VOICE} ${AI_QUALITY_FIRST} 시즌 RAG와 후보 목록만 근거로 이번 달 가성비 여행지를 JSON으로 큐레이션해요.`;

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
지금(${params.year}년 ${params.month}월) 기준으로 후보 중 가성비 좋은 순으로 정렬하고 highlight를 풍부하게 갱신하세요.
${AI_QUALITY_FIRST}

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
{"deals":[{"id":"deal-xxx","highlight":"이번 달 기준 구체적 하이라이트 (왜 가성비인지 포함)"}]}

규칙:
- 후보 id만 사용, 전부 포함
- 시즌·가성비 좋은 순 정렬
- highlight는 한국어 40~80자, 해요체, 시즌 이유·누구에게 맞는지 포함
- 허위 시세 단정 금지
- ${AI_VOICE}`;
}
