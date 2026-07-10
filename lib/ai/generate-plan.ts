import type { OnboardingForm } from "@/components/onboarding/types";
import { normalizeFlexibleYear } from "@/components/onboarding/types";
import { AIRPORT_PLACES } from "@/lib/airports/data";
import { STYLE_LABELS } from "@/lib/trips/data";
import { retrieveBudgetRag } from "@/lib/rag/budgetBands";
import { getMonthDealTip } from "@/lib/rag/monthDeals";
import { retrieveTravelSources } from "@/lib/rag/travelKnowledge";
import type {
  BudgetAllocation,
  DaySchedule,
  RagSource,
  TripRecommendation,
} from "./types";

const DESTINATION_IMAGES: Record<string, string> = {
  default:
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80",
  파리:
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
  도쿄:
    "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80",
  오사카:
    "https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=800&q=80",
  방콕:
    "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=800&q=80",
  런던:
    "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
  다낭:
    "https://images.unsplash.com/photo-1559592413-7cec4b0e8f9f?auto=format&fit=crop&w=800&q=80",
};

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

function getImageUrl(city: string): string {
  for (const [key, url] of Object.entries(DESTINATION_IMAGES)) {
    if (key !== "default" && city.includes(key)) return url;
  }
  return DESTINATION_IMAGES.default;
}

function getNights(dateType: OnboardingForm["dateType"]): number {
  return dateType === "flexible" ? 5 : 4;
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
  nights: number
): DaySchedule[] {
  const foodPerDay = Math.round(
    allocation.find((a) => a.id === "food")!.amount / nights
  );
  const activityPerDay = Math.round(
    allocation.find((a) => a.id === "activity")!.amount / nights
  );
  const transportPerDay = Math.round(
    allocation.find((a) => a.id === "transport")!.amount / nights
  );

  const { city } = parseDestination(form.destination);
  const styleSet = new Set(form.styles);

  const dayTemplates = [
    {
      label: "도착 & 시내 적응",
      items: [
        { time: "14:00", title: `${city} 공항 도착 · 시내 이동`, cost: transportPerDay },
        { time: "16:00", title: "숙소 체크인 & 휴식", cost: 0 },
        { time: "18:30", title: "현지 맛집 탐방", cost: foodPerDay },
      ],
    },
    {
      label: styleSet.has("sightseeing") ? "핵심 관광" : "여유로운 탐방",
      items: [
        { time: "09:30", title: `${city} 대표 명소 투어`, cost: activityPerDay },
        { time: "13:00", title: "로컬 레스토랑", cost: foodPerDay },
        { time: "15:30", title: "카페 & 산책", cost: Math.round(activityPerDay * 0.3) },
      ],
    },
    {
      label: styleSet.has("culture") ? "문화·예술" : "로컬 체험",
      items: [
        { time: "10:00", title: "박물관/문화 공간", cost: activityPerDay },
        { time: "14:00", title: "시장 또는 쇼핑 거리", cost: Math.round(foodPerDay * 0.8) },
        { time: "19:00", title: "야경 스팟", cost: transportPerDay },
      ],
    },
    {
      label: styleSet.has("healing") ? "힐링 데이" : "자유 일정",
      items: [
        { time: "11:00", title: "스파/온천 또는 해변", cost: activityPerDay },
        { time: "15:00", title: "브런치 카페", cost: foodPerDay },
        { time: "17:00", title: "기념품 쇼핑", cost: Math.round(activityPerDay * 0.4) },
      ],
    },
    {
      label: "출발",
      items: [
        { time: "10:00", title: "체크아웃 & 마지막 산책", cost: 0 },
        { time: "12:00", title: "공항 이동", cost: transportPerDay },
        { time: "15:00", title: `${form.origin} 행 항공편`, cost: 0 },
      ],
    },
  ];

  return dayTemplates.slice(0, nights + 1).map((day, index) => {
    const items = day.items;
    const dayTotal = items.reduce((sum, item) => sum + item.cost, 0);
    return { day: index + 1, label: day.label, items, dayTotal };
  });
}

export function generateTripPlan(form: OnboardingForm): TripRecommendation {
  const totalBudget = parseBudget(form.budget);
  const people = Math.max(1, form.people);
  const perPerson = Math.floor(totalBudget / people);
  const { city, country } = parseDestination(form.destination);
  const travelSources = retrieveTravelSources(form);
  const nights = getNights(form.dateType);
  const weights = getBudgetWeights(form.styles);
  const budgetAllocation = buildAllocation(totalBudget, weights);

  const flightAmount = budgetAllocation.find((a) => a.id === "flight")!.amount;
  const hotelAmount = budgetAllocation.find((a) => a.id === "hotel")!.amount;
  const pricePerNight = Math.round(hotelAmount / nights);

  const month = new Date().getMonth() + 1;
  const selectedYear =
    form.dateType === "flexible"
      ? normalizeFlexibleYear(form.flexibleYear)
      : new Date().getFullYear();
  const selectedMonth =
    form.dateType === "flexible" &&
    form.flexibleMonth >= 1 &&
    form.flexibleMonth <= 12
      ? form.flexibleMonth
      : month + 1;
  const specificDateRange =
    form.startDate && form.endDate
      ? `${formatIsoDateToKorean(form.startDate)} - ${formatIsoDateToKorean(
          form.endDate
        )}`
      : `${month + 1}월 12일 - ${month + 1}월 ${12 + nights - 1}일`;
  const dateRange =
    form.dateType === "flexible"
      ? `${selectedYear}년 ${selectedMonth}월 중순 · ${nights}박 ${nights + 1}일 (유연 일정)`
      : specificDateRange;

  const styleLabels = form.styles.map((s) => STYLE_LABELS[s] ?? s);

  const budgetRag = retrieveBudgetRag(perPerson, selectedMonth);
  const monthTip = getMonthDealTip(selectedMonth);
  const ragSources: RagSource[] = [
    {
      id: `budget-${budgetRag.band.id}`,
      category: "예산",
      title: `1인당 예산 구간 · ${budgetRag.band.nights}`,
      content: `${budgetRag.band.content} 허용 권역: ${budgetRag.allowedRegions.join(", ")}.`,
    },
    {
      id: `season-${monthTip.month}`,
      category: "시즌",
      title: `${monthTip.month}월 저가·주의`,
      content: `${monthTip.cheapPlaces.join("·")} 쪽이 비교적 저렴해요. ${monthTip.dealReason}. 다만 ${monthTip.caution}`,
    },
    ...travelSources.slice(0, 3),
  ];

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
    summary: `${form.origin}에서 ${city}로 떠나는 ${nights + 1}일 일정이에요. 총예산 ${totalBudget.toLocaleString(
      "ko-KR"
    )}원을 ${people}명으로 나눠 1인당 약 ${perPerson.toLocaleString(
      "ko-KR"
    )}원 기준으로 항공·숙소·일정을 맞춰 드렸어요.`,
    imageUrl: getImageUrl(city),
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
    dailySchedule: buildDailySchedule(form, budgetAllocation, nights),
    tips: [
      `${styleLabels.join(", ")} 스타일에 맞춰 동선을 최적화했어요.`,
      ...travelSources.slice(0, 2).map((s) => s.content),
      budgetRag.seasonTip,
    ],
    ragSources,
  };
}
