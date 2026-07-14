import type { OnboardingForm } from "@/components/onboarding/types";
import { normalizeFlexibleYear } from "@/components/onboarding/types";
import { AIRPORT_PLACES } from "@/lib/airports/data";
import { STYLE_LABELS } from "@/lib/trips/data";
import { retrieveBudgetRag } from "@/lib/rag/budgetBands";
import { getMonthDealTip } from "@/lib/rag/monthDeals";
import { retrieveTravelSources } from "@/lib/rag/travelKnowledge";
import {
  resolvePlanSummaryLocal,
  resolvePlanSummaryWithRag,
} from "@/lib/ai/budget-reality-check";
import {
  buildPlanItineraryPrompt,
  getPlanSystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";
import { aiChatOrNull } from "@/lib/ai/chat-client";
import { parsePlanItinerary } from "@/lib/ai/contracts";
import { optimizeDailyScheduleRoutes } from "@/lib/route/optimize-schedule";
import { resolveDestinationImage } from "@/lib/trips/destination-image";
import { buildDestinationPoiSchedule, buildDynamicPoiSchedule } from "@/lib/ai/destination-pois";
import {
  fetchDestinationKnowledge,
  knowledgeToRagContexts,
  type DestinationKnowledge,
} from "@/lib/ai/destination-knowledge";
import type {
  BudgetAllocation,
  DaySchedule,
  FlightPlan,
  HotelPlan,
  RagSource,
  TripRecommendation,
} from "./types";

function parseBudget(raw: string): number {
  return Number(raw.replace(/[^0-9]/g, "")) || 0;
}

function parseDestination(destination: string) {
  const matched = AIRPORT_PLACES.find(
    (p) =>
      p.name === destination ||
      `${p.city}, ${p.country}` === destination ||
      `${p.city} · ${p.name}` === destination
  );
  if (matched) {
    return { city: matched.city, country: matched.country };
  }
  const parts = destination.split(/[,，]/).map((s) => s.trim());
  if (parts.length >= 2) {
    const cityPart = parts[0].replace(/\s*·\s*.+$/, "").trim();
    return { city: cityPart || parts[0], country: parts[1] };
  }
  const dotted = destination.split("·").map((s) => s.trim());
  if (dotted.length >= 2) {
    return { city: dotted[0], country: "" };
  }
  return { city: destination.trim(), country: "" };
}

function formatIsoDateToKorean(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map((v) => Number(v));
  if (!year || !month || !day) return value;
  return `${month}월 ${day}일`;
}

function getNights(form: OnboardingForm): number {
  if (form.dateType === "specific" && form.startDate && form.endDate) {
    const start = Date.parse(`${form.startDate}T00:00:00`);
    const end = Date.parse(`${form.endDate}T00:00:00`);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      const nights = Math.round((end - start) / (24 * 60 * 60 * 1000));
      return Math.max(1, nights);
    }
  }
  // 유연 일정 기본 5박 6일
  return 5;
}

function getBudgetWeights(styles: OnboardingForm["styles"]) {
  const weights = {
    flight: 0.38,
    hotel: 0.28,
    food: 0.16,
    transport: 0.08,
    activity: 0.1,
  };

  if (styles.includes("food")) {
    weights.food += 0.04;
    weights.activity -= 0.02;
    weights.transport -= 0.02;
  }
  if (styles.includes("healing")) {
    weights.hotel += 0.05;
    weights.activity -= 0.05;
  }
  if (styles.includes("shopping")) {
    weights.activity += 0.04;
    weights.food -= 0.04;
  }
  if (styles.includes("sightseeing") || styles.includes("culture")) {
    weights.activity += 0.03;
    weights.transport += 0.02;
    weights.food -= 0.05;
  }

  return weights;
}

function buildAllocation(
  total: number,
  weights: ReturnType<typeof getBudgetWeights>
): BudgetAllocation[] {
  const items = [
    { id: "flight", label: "항공권", weight: weights.flight, color: "#2563EB" },
    { id: "hotel", label: "숙소", weight: weights.hotel, color: "#7C3AED" },
    { id: "food", label: "식비", weight: weights.food, color: "#F59E0B" },
    { id: "transport", label: "교통", weight: weights.transport, color: "#10B981" },
    { id: "activity", label: "관광·액티비티", weight: weights.activity, color: "#EC4899" },
  ];

  return items.map((item) => {
    const amount = Math.round(total * item.weight);
    return {
      id: item.id,
      label: item.label,
      amount,
      percent: Math.round(item.weight * 100),
      color: item.color,
    };
  });
}

function buildDailySchedule(
  form: OnboardingForm,
  allocation: BudgetAllocation[],
  nights: number,
  knowledge?: DestinationKnowledge | null
): DaySchedule[] {
  const divisor = Math.max(1, nights);
  const foodPerDay = Math.round(
    allocation.find((a) => a.id === "food")!.amount / divisor
  );
  const activityPerDay = Math.round(
    allocation.find((a) => a.id === "activity")!.amount / divisor
  );
  const transportPerDay = Math.round(
    allocation.find((a) => a.id === "transport")!.amount / divisor
  );
  const budgets = {
    food: foodPerDay,
    activity: activityPerDay,
    transport: transportPerDay,
  };

  const { city } = parseDestination(form.destination);
  const styleSet = new Set(form.styles);

  const hardcoded = buildDestinationPoiSchedule(
    city,
    nights,
    form.styles,
    budgets
  );
  if (hardcoded) return hardcoded;

  if (knowledge?.attractions?.length) {
    const dynamic = buildDynamicPoiSchedule(
      city,
      form.origin,
      nights,
      form.styles,
      budgets,
      knowledge.attractions
    );
    if (dynamic) return dynamic;
  }

  const dayTemplates = [
    {
      label: "도착 & 시내 적응",
      items: [
        {
          time: "14:00",
          title: `${city} 공항 도착 · 시내 이동`,
          detail: `${form.origin}에서 도착한 뒤 대중교통·택시로 시내로 이동해요.`,
          cost: transportPerDay,
        },
        {
          time: "16:00",
          title: "숙소 체크인 & 휴식",
          detail: "시내 숙소에 짐을 내려놓고 가볍게 쉬어요.",
          cost: 0,
        },
        {
          time: "18:30",
          title: `${city} 시내 저녁`,
          detail: "숙소 근처 식당에서 첫 저녁을 먹으며 동네를 익혀요.",
          cost: foodPerDay,
        },
      ],
    },
    {
      label: styleSet.has("sightseeing") ? "핵심 관광" : "여유로운 탐방",
      items: [
        {
          time: "09:30",
          title: `${city} 시내 핵심 스팟`,
          detail: "시내 중심의 대표 구역을 걸으며 오전을 보내요.",
          cost: activityPerDay,
        },
        {
          time: "13:00",
          title: `${city} 로컬 레스토랑`,
          detail: "현지 메뉴로 점심을 먹고 잠깐 쉬어요.",
          cost: foodPerDay,
        },
        {
          time: "15:30",
          title: `${city} 카페·거리 산책`,
          detail: "카페거리에서 여유를 즐기고 사진을 남겨요.",
          cost: Math.round(activityPerDay * 0.3),
        },
      ],
    },
    {
      label: styleSet.has("culture") ? "문화·예술" : "로컬 체험",
      items: [
        {
          time: "10:00",
          title: `${city} 박물관·전시`,
          detail: "현지 역사·문화를 알 수 있는 전시 공간을 찾아가요.",
          cost: activityPerDay,
        },
        {
          time: "14:00",
          title: `${city} 시장·상점가`,
          detail: "로컬 마켓을 돌며 간식과 기념품을 구경해요.",
          cost: Math.round(foodPerDay * 0.8),
        },
        {
          time: "19:00",
          title: `${city} 야경 스팟`,
          detail: "해 질 녘 전망 좋은 곳에서 야경을 감상해요.",
          cost: transportPerDay,
        },
      ],
    },
    {
      label: styleSet.has("healing") ? "힐링 데이" : "자유 일정",
      items: [
        {
          time: "11:00",
          title: `${city} 공원·해변`,
          detail: "초록 공간이나 물가에서 여유롭게 시간을 보내요.",
          cost: activityPerDay,
        },
        {
          time: "15:00",
          title: `${city} 브런치 카페`,
          detail: "분위기 좋은 카페에서 늦은 브런치를 즐겨요.",
          cost: foodPerDay,
        },
        {
          time: "17:00",
          title: `${city} 기념품 거리`,
          detail: "귀국 전에 기념품을 고르며 산책해요.",
          cost: Math.round(activityPerDay * 0.4),
        },
      ],
    },
    {
      label: "출발",
      items: [
        {
          time: "10:00",
          title: "체크아웃 & 마지막 산책",
          detail: "체크아웃 후 남는 시간에 근처를 한 바퀴 돌아요.",
          cost: 0,
        },
        {
          time: "12:00",
          title: "공항 이동",
          detail: `${form.origin}행에 맞춰 여유 있게 공항으로 이동해요.`,
          cost: transportPerDay,
        },
        {
          time: "15:00",
          title: `${form.origin} 행 항공편`,
          detail: "탑승 수속을 마치고 귀국 일정으로 이어가요.",
          cost: 0,
        },
      ],
    },
  ];

  return dayTemplates.slice(0, nights + 1).map((day, index) => {
    const items = day.items;
    const dayTotal = items.reduce((sum, item) => sum + item.cost, 0);
    return { day: index + 1, label: day.label, items, dayTotal };
  });
}

function estimateItemCost(
  title: string,
  budgets: { food: number; activity: number; transport: number }
): number {
  const t = title.toLowerCase();
  if (/공항|이동|교통|체크인|체크아웃|출발|도착/.test(t)) {
    return /체크인|체크아웃|출발/.test(t) ? 0 : budgets.transport;
  }
  if (/식사|맛집|레스토랑|카페|브런치|야시장|먹/.test(t)) {
    return budgets.food;
  }
  if (/쇼핑|기념품/.test(t)) {
    return Math.round(budgets.activity * 0.4);
  }
  return budgets.activity;
}

function mergeAiSchedule(
  aiDays: Array<{
    day?: number;
    label?: string;
    items?: Array<{ time?: string; title?: string; detail?: string }>;
  }>,
  fallback: DaySchedule[],
  allocation: BudgetAllocation[],
  nights: number,
  knowledge?: DestinationKnowledge | null
): DaySchedule[] {
  if (!Array.isArray(aiDays) || aiDays.length === 0) return fallback;

  const foodPerDay = Math.round(
    (allocation.find((a) => a.id === "food")?.amount ?? 0) / Math.max(1, nights)
  );
  const activityPerDay = Math.round(
    (allocation.find((a) => a.id === "activity")?.amount ?? 0) /
      Math.max(1, nights)
  );
  const transportPerDay = Math.round(
    (allocation.find((a) => a.id === "transport")?.amount ?? 0) /
      Math.max(1, nights)
  );
  const budgets = {
    food: foodPerDay,
    activity: activityPerDay,
    transport: transportPerDay,
  };

  const attractionByName = new Map(
    (knowledge?.attractions ?? []).map((a) => [a.name.toLowerCase(), a.detail])
  );

  const expectedDays = nights + 1;
  const sliced = aiDays.slice(0, expectedDays);

  return sliced.map((day, index) => {
    const fallbackDay = fallback[index] ?? fallback[fallback.length - 1];
    const rawItems = Array.isArray(day.items) ? day.items : [];
    const items =
      rawItems.length > 0
        ? rawItems
            .map((item, itemIndex) => {
              const title = item.title?.trim() || "자유 시간";
              const fallbackDetail = fallbackDay.items[itemIndex]?.detail;
              const matchedDetail = attractionByName.get(title.toLowerCase());
              const detail =
                item.detail?.trim() ||
                matchedDetail ||
                fallbackDetail ||
                `${title}에서 현지 분위기를 느껴 보세요. 이동 시간까지 여유를 두고 둘러봐요.`;
              return {
                time: item.time?.trim() || "10:00",
                title,
                detail,
                cost: estimateItemCost(`${title} ${detail}`, budgets),
              };
            })
            .slice(0, 12)
        : fallbackDay.items;

    return {
      day: index + 1,
      label: day.label?.trim() || fallbackDay.label,
      items,
      dayTotal: items.reduce((sum, item) => sum + item.cost, 0),
    };
  });
}

async function enrichPlanWithAi(params: {
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
  fallbackSchedule: DaySchedule[];
  fallbackFlight: FlightPlan;
  fallbackHotel: HotelPlan;
  fallbackTips: string[];
  allocation: BudgetAllocation[];
  knowledge?: DestinationKnowledge | null;
}): Promise<{
  summary?: string;
  flight: FlightPlan;
  hotel: HotelPlan;
  dailySchedule: DaySchedule[];
  tips: string[];
  source: "ai" | "fallback";
}> {
  const chat = await aiChatOrNull({
    mode: "plan",
    system: getPlanSystemPrompt(),
    prompt: buildPlanItineraryPrompt({
      origin: params.origin,
      destination: params.destination,
      country: params.country,
      nights: params.nights,
      people: params.people,
      totalBudget: params.totalBudget,
      perPerson: params.perPerson,
      dateRange: params.dateRange,
      styleLabels: params.styleLabels,
      flightBudget: params.flightBudget,
      hotelBudget: params.hotelBudget,
      ragContexts: params.ragContexts,
      destinationSummary: params.destinationSummary,
      attractions: params.attractions,
    }),
  });

  if (!chat) {
    return {
      flight: params.fallbackFlight,
      hotel: params.fallbackHotel,
      dailySchedule: params.fallbackSchedule,
      tips: params.fallbackTips,
      source: "fallback",
    };
  }

  const parsed = parsePlanItinerary(chat.content);
  if (!parsed) {
    return {
      flight: params.fallbackFlight,
      hotel: params.fallbackHotel,
      dailySchedule: params.fallbackSchedule,
      tips: params.fallbackTips,
      source: "fallback",
    };
  }

  const tips =
    parsed.tips && parsed.tips.length > 0
      ? parsed.tips.slice(0, 10)
      : params.fallbackTips;

  return {
    summary: parsed.summary || undefined,
    flight: {
      ...params.fallbackFlight,
      airline: parsed.flight?.airline || params.fallbackFlight.airline,
      schedule: parsed.flight?.schedule || params.fallbackFlight.schedule,
      note: parsed.flight?.note || params.fallbackFlight.note,
    },
    hotel: {
      ...params.fallbackHotel,
      name: parsed.hotel?.name || params.fallbackHotel.name,
      area: parsed.hotel?.area || params.fallbackHotel.area,
      note: parsed.hotel?.note || params.fallbackHotel.note,
    },
    dailySchedule: mergeAiSchedule(
      parsed.dailySchedule ?? [],
      params.fallbackSchedule,
      params.allocation,
      params.nights,
      params.knowledge
    ),
    tips,
    source: "ai",
  };
}

function getSelectedMonth(form: OnboardingForm): number {
  const month = new Date().getMonth() + 1;
  if (
    form.dateType === "flexible" &&
    form.flexibleMonth >= 1 &&
    form.flexibleMonth <= 12
  ) {
    return form.flexibleMonth;
  }
  if (form.startDate) {
    return Number(form.startDate.slice(5, 7)) || month;
  }
  return month;
}

function getDateRange(form: OnboardingForm, nights: number): string {
  const selectedYear =
    form.dateType === "flexible"
      ? normalizeFlexibleYear(form.flexibleYear)
      : new Date().getFullYear();
  const selectedMonth = getSelectedMonth(form);
  const specificDateRange =
    form.startDate && form.endDate
      ? `${formatIsoDateToKorean(form.startDate)} - ${formatIsoDateToKorean(
          form.endDate
        )}`
      : `${selectedMonth}월 12일 - ${selectedMonth}월 ${12 + nights - 1}일`;

  return form.dateType === "flexible"
    ? `${selectedYear}년 ${selectedMonth}월 중순 · ${nights}박 ${nights + 1}일 (유연 일정)`
    : `${specificDateRange} · ${nights}박 ${nights + 1}일`;
}

function buildBaseRagSources(params: {
  budgetRag: ReturnType<typeof retrieveBudgetRag>;
  monthTip: ReturnType<typeof getMonthDealTip>;
  travelSources: RagSource[];
  summaryTone: "normal" | "factbomb";
  summarySource: string;
}): RagSource[] {
  const ragSources: RagSource[] = [
    {
      id: `budget-${params.budgetRag.band.id}`,
      category: "예산",
      title: `1인당 예산 구간 · ${params.budgetRag.band.nights}`,
      content: `${params.budgetRag.band.content} 허용 권역: ${params.budgetRag.allowedRegions.join(", ")}.`,
    },
    {
      id: `season-${params.monthTip.month}`,
      category: "시즌",
      title: `${params.monthTip.month}월 저가·주의`,
      content: `${params.monthTip.cheapPlaces.join("·")} 쪽이 비교적 저렴해요. ${params.monthTip.dealReason}. 다만 ${params.monthTip.caution}`,
    },
    ...params.travelSources.slice(0, 6),
  ];

  if (params.summaryTone === "factbomb") {
    ragSources.unshift({
      id: `factbomb-${params.summarySource}`,
      category: "예산",
      title:
        params.summarySource === "ai+rag"
          ? "AI 팩트폭격 (RAG+LLM)"
          : "AI 팩트폭격 (템플릿 폴백)",
      content: params.budgetRag.contexts.join(" "),
    });
  }

  return ragSources;
}

/** AI 없이 즉시 보여줄 폴백 일정 (동기 — 클라이언트 첫 페인트용) */
export function buildFallbackTripPlan(
  form: OnboardingForm,
  knowledge?: DestinationKnowledge | null
): TripRecommendation {
  const totalBudget = parseBudget(form.budget);
  const people = Math.max(1, form.people);
  const perPerson = Math.floor(totalBudget / people);
  const { city, country } = parseDestination(form.destination);
  const travelSources = retrieveTravelSources(form);
  const nights = getNights(form);
  const weights = getBudgetWeights(form.styles);
  const budgetAllocation = buildAllocation(totalBudget, weights);
  const flightAmount = budgetAllocation.find((a) => a.id === "flight")!.amount;
  const hotelAmount = budgetAllocation.find((a) => a.id === "hotel")!.amount;
  const pricePerNight = Math.round(hotelAmount / Math.max(1, nights));
  const selectedMonth = getSelectedMonth(form);
  const dateRange = getDateRange(form, nights);
  const styleLabels = form.styles.map((s) => STYLE_LABELS[s] ?? s);
  const budgetRag = retrieveBudgetRag(perPerson, selectedMonth);
  const monthTip = getMonthDealTip(selectedMonth);

  const summaryResult = resolvePlanSummaryLocal({
    formOrigin: form.origin,
    destination: city,
    country: country || "해외",
    nights,
    totalBudget,
    people,
    perPerson,
    allowedRegions: budgetRag.allowedRegions,
    month: selectedMonth,
    styleLabels,
  });

  const tips =
    summaryResult.tone === "factbomb"
      ? [
          budgetRag.allowedRegions.length > 0
            ? `지금 예산엔 ${budgetRag.allowedRegions.slice(0, 3).join("·")} 쪽이 현실적이에요. 예산을 올리거나 목적지를 바꾸면 더 맞는 일정이 나와요.`
            : "예산을 올리거나 목적지를 바꾸면 훨씬 그럴듯한 일정이 나와요.",
          `${styleLabels.join(", ") || "자유"} 스타일 기준으로 동선을 잡아 두었어요. ${budgetRag.seasonTip}`,
        ].filter(Boolean)
      : [
          `${styleLabels.join(", ") || "자유"} 스타일에 맞춰 동선을 최적화했어요.`,
          ...travelSources.slice(0, 4).map((s) => s.content),
          budgetRag.seasonTip,
        ].filter(Boolean);

  const ragSources = buildBaseRagSources({
    budgetRag,
    monthTip,
    travelSources,
    summaryTone: summaryResult.tone,
    summarySource: summaryResult.source,
  });

  if (knowledge?.summary) {
    ragSources.push({
      id: "dest-wiki",
      category: "일정",
      title: `${city} 목적지 지식`,
      content: knowledge.summary.slice(0, 280),
    });
  }

  return {
    id: `plan-${Date.now()}`,
    form,
    destination: city,
    country: country || "해외",
    origin: form.origin,
    people,
    totalBudget,
    dateRange,
    nights,
    summary: summaryResult.summary,
    summaryTone: summaryResult.tone,
    imageUrl: resolveDestinationImage(city, country),
    styleLabels,
    budgetAllocation,
    flight: {
      airline: totalBudget > 3000000 ? "대한항공" : "저비용 항공 추천",
      route: `${form.origin} → ${city}`,
      schedule: `가는 편 09:40 · 오는 편 18:20`,
      price: flightAmount,
      note:
        form.dateType === "flexible"
          ? "유연 일정이므로 요일에 따라 8~15% 절약 가능해요."
          : "성수기 전 주중 항공권 기준 예상가예요.",
    },
    hotel: {
      name: styleLabels.includes("힐링")
        ? `${city} 리조트 & 스파`
        : `${city} 시내 호텔`,
      area: "도심/관광지 인접",
      nights,
      pricePerNight,
      total: hotelAmount,
      note: `${people}인 기준 · 조식 포함 옵션`,
    },
    dailySchedule: buildDailySchedule(form, budgetAllocation, nights, knowledge),
    tips,
    ragSources,
  };
}

/** 웹 지식 반영 폴백 (서버/enrich용) */
export async function buildFallbackTripPlanAsync(
  form: OnboardingForm
): Promise<{ plan: TripRecommendation; knowledge: DestinationKnowledge }> {
  const { city, country } = parseDestination(form.destination);
  let knowledge: DestinationKnowledge = {
    city,
    country: country || "",
    summary: "",
    attractions: [],
    source: "empty",
  };
  try {
    knowledge = await fetchDestinationKnowledge(city, country || "");
  } catch (error) {
    console.error("[destination-knowledge] fetch failed:", error);
  }
  return { plan: buildFallbackTripPlan(form, knowledge), knowledge };
}

/** 폴백 일정을 AI로 보강 (요약·일정·항공·숙소) */
export async function enrichTripPlanWithAi(
  fallback: TripRecommendation,
  prefetchedKnowledge?: DestinationKnowledge | null
): Promise<TripRecommendation> {
  const form = fallback.form;
  const totalBudget = fallback.totalBudget;
  const people = fallback.people;
  const perPerson = Math.floor(totalBudget / people);
  const city = fallback.destination;
  const country = fallback.country;
  // 박수는 폼 날짜 기준으로 재계산 (클라이언트 폴백이 옛 로직이어도 교정)
  const nights = getNights(form);
  const dateRange = getDateRange(form, nights);
  const styleLabels = fallback.styleLabels;
  const budgetAllocation = fallback.budgetAllocation;
  const selectedMonth = getSelectedMonth(form);
  const travelSources = retrieveTravelSources(form);
  const budgetRag = retrieveBudgetRag(perPerson, selectedMonth);
  const monthTip = getMonthDealTip(selectedMonth);
  const flightAmount = budgetAllocation.find((a) => a.id === "flight")!.amount;
  const hotelAmount = budgetAllocation.find((a) => a.id === "hotel")!.amount;

  let knowledge = prefetchedKnowledge ?? null;
  if (!knowledge) {
    try {
      knowledge = await fetchDestinationKnowledge(city, country || "");
    } catch (error) {
      console.error("[destination-knowledge] enrich fetch failed:", error);
      knowledge = {
        city,
        country: country || "",
        summary: "",
        attractions: [],
        source: "empty",
      };
    }
  }

  const knowledgeAwareFallback = buildFallbackTripPlan(form, knowledge);
  const scheduleBase =
    knowledgeAwareFallback.dailySchedule.length > 0
      ? knowledgeAwareFallback.dailySchedule
      : fallback.dailySchedule;

  const ragContexts = [
    ...knowledgeToRagContexts(knowledge),
    ...budgetRag.contexts,
    ...travelSources.map((source) => source.content),
    budgetRag.seasonTip,
    monthTip.dealReason,
    monthTip.caution,
  ];

  const baseFallbackTips = [
    `${styleLabels.join(", ") || "자유"} 스타일에 맞춰 동선을 최적화했어요.`,
    ...travelSources.slice(0, 4).map((s) => s.content),
    budgetRag.seasonTip,
  ];

  const [summaryResult, enriched] = await Promise.all([
    resolvePlanSummaryWithRag({
      formOrigin: form.origin,
      destination: city,
      country: country || "해외",
      nights,
      totalBudget,
      people,
      perPerson,
      allowedRegions: budgetRag.allowedRegions,
      month: selectedMonth,
      styleLabels,
    }),
    enrichPlanWithAi({
      origin: form.origin,
      destination: city,
      country: country || "해외",
      nights,
      people,
      totalBudget,
      perPerson,
      dateRange,
      styleLabels,
      flightBudget: flightAmount,
      hotelBudget: hotelAmount,
      ragContexts,
      destinationSummary: knowledge.summary,
      attractions: knowledge.attractions.map((a) => ({
        name: a.name,
        detail: a.detail,
      })),
      fallbackSchedule: scheduleBase,
      fallbackFlight: {
        ...fallback.flight,
        // nights-corrected hotel nights mirrored in plan later
      },
      fallbackHotel: {
        ...fallback.hotel,
        nights,
        pricePerNight: Math.round(hotelAmount / Math.max(1, nights)),
        total: hotelAmount,
      },
      fallbackTips: baseFallbackTips,
      allocation: budgetAllocation,
      knowledge,
    }),
  ]);

  const {
    summary: baseSummary,
    tone: summaryTone,
    source: summarySource,
  } = summaryResult;

  const tips =
    summaryTone === "factbomb"
      ? [
          budgetRag.allowedRegions.length > 0
            ? `지금 예산엔 ${budgetRag.allowedRegions.slice(0, 3).join("·")} 쪽이 현실적이에요. 예산을 올리거나 목적지를 바꾸면 더 맞는 일정이 나와요.`
            : "예산을 올리거나 목적지를 바꾸면 훨씬 그럴듯한 일정이 나와요.",
          ...enriched.tips.slice(0, 6),
        ]
      : enriched.tips.slice(0, 8);

  const ragSources = buildBaseRagSources({
    budgetRag,
    monthTip,
    travelSources,
    summaryTone,
    summarySource,
  });

  if (knowledge.summary) {
    ragSources.push({
      id: "dest-wiki",
      category: "일정",
      title: `${city} 목적지 지식 (${knowledge.source})`,
      content: knowledge.summary.slice(0, 280),
    });
  }
  if (knowledge.attractions.length > 0) {
    ragSources.push({
      id: "dest-attractions",
      category: "일정",
      title: `${city} 실명 명소 ${knowledge.attractions.length}곳`,
      content: knowledge.attractions
        .slice(0, 8)
        .map((a) => a.name)
        .join(" · "),
    });
  }

  if (enriched.source === "ai") {
    ragSources.push({
      id: "plan-ai",
      category: "일정",
      title: "AI 일정·항공·숙소 생성",
      content:
        "OpenRouter LLM이 목적지 웹 지식·RAG를 근거로 일정·항공·숙소 안내를 생성했어요.",
    });
  }

  const summary =
    summaryTone === "factbomb"
      ? baseSummary
      : enriched.summary || baseSummary;

  let dailySchedule = enriched.dailySchedule;
  let tipsOut = tips;
  let routeOptimization: TripRecommendation["routeOptimization"];

  try {
    const { schedule, meta } = await optimizeDailyScheduleRoutes(
      enriched.dailySchedule,
      city,
      country || ""
    );
    dailySchedule = schedule;
    routeOptimization = {
      applied: meta.applied,
      method: meta.method,
      savedKm: meta.savedKm,
      totalKmBefore: meta.totalKmBefore,
      totalKmAfter: meta.totalKmAfter,
    };
    if (meta.applied) {
      const savedLabel =
        meta.savedKm >= 0.1
          ? `약 ${meta.savedKm.toFixed(1)}km`
          : "이동 거리";
      tipsOut = [
        `유전 알고리즘으로 하루 동선을 재배치해 ${savedLabel}를 줄였어요.`,
        ...tipsOut,
      ].slice(0, 10);
      ragSources.push({
        id: "route-ga",
        category: "동선",
        title: "유전 알고리즘 경로 최적화",
        content: `일정 장소 좌표를 기준으로 open-path TSP를 유전 알고리즘으로 풀어, 이동 거리를 ${meta.totalKmBefore.toFixed(1)}km → ${meta.totalKmAfter.toFixed(1)}km로 줄였어요.`,
      });
    }
  } catch (error) {
    console.error("[route-optimize] skipped:", error);
  }

  return {
    ...fallback,
    ...knowledgeAwareFallback,
    nights,
    dateRange,
    summary,
    summaryTone,
    flight: enriched.flight,
    hotel: {
      ...enriched.hotel,
      nights,
      pricePerNight: Math.round(hotelAmount / Math.max(1, nights)),
      total: hotelAmount,
    },
    dailySchedule,
    tips: tipsOut,
    ragSources,
    routeOptimization,
    aiScheduleSource: enriched.source,
  };
}

export async function generateTripPlan(
  form: OnboardingForm
): Promise<TripRecommendation> {
  const { plan, knowledge } = await buildFallbackTripPlanAsync(form);
  return enrichTripPlanWithAi(plan, knowledge);
}
