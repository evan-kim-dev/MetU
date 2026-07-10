import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend/client";
import {
  buildScheduleInsightPrompt,
  getScheduleSystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";
import {
  formatMonthDealInsight,
  getMonthDealTip,
} from "@/lib/rag/monthDeals";
import { retrieveTravelSources } from "@/lib/rag/travelKnowledge";
import type { OnboardingForm } from "@/components/onboarding/types";

type DateType = "specific" | "flexible";

function buildLocalScheduleInsight(params: {
  origin: string;
  destination: string;
  dateType: DateType;
  startDate: string;
  endDate: string;
  flexibleYear: number;
  flexibleMonth: number;
}): string {
  if (params.dateType === "specific") {
    if (params.startDate && params.endDate) {
      const from = params.origin || "출발지";
      const to = params.destination || "목적지";
      return `${from} → ${to}, ${params.startDate}~${params.endDate} 기준으로 항공·숙소 예산을 맞춰 드릴게요.`;
    }
    return "선택한 기간 기반으로 최적 예산 분배를 진행해요.";
  }

  return `${params.flexibleYear}년 ${formatMonthDealInsight(params.flexibleMonth)}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      origin?: string;
      destination?: string;
      dateType?: DateType;
      startDate?: string;
      endDate?: string;
      flexibleYear?: number;
      flexibleMonth?: number;
    };

    const params = {
      origin: body.origin?.trim() ?? "",
      destination: body.destination?.trim() ?? "",
      dateType:
        body.dateType === "specific"
          ? ("specific" as const)
          : ("flexible" as const),
      startDate: body.startDate ?? "",
      endDate: body.endDate ?? "",
      flexibleYear:
        typeof body.flexibleYear === "number"
          ? body.flexibleYear
          : new Date().getFullYear(),
      flexibleMonth:
        typeof body.flexibleMonth === "number" &&
        body.flexibleMonth >= 1 &&
        body.flexibleMonth <= 12
          ? body.flexibleMonth
          : new Date().getMonth() + 1,
    };

    const fallback = buildLocalScheduleInsight(params);
    const seasonMonth =
      params.dateType === "specific" && params.startDate
        ? Number(params.startDate.slice(5, 7)) || params.flexibleMonth
        : params.flexibleMonth;
    const tip = getMonthDealTip(seasonMonth);

    const form: OnboardingForm = {
      origin: params.origin || "서울",
      destination: params.destination || "어디든지",
      budget: "1000000",
      people: 1,
      dateType: params.dateType,
      startDate: params.startDate,
      endDate: params.endDate,
      flexibleMonth: seasonMonth,
      flexibleYear: params.flexibleYear,
      styles: [],
    };
    const travelRag = retrieveTravelSources(form, 3).map((item) => item.content);

    const ragContexts = [
      `${seasonMonth}월 가성비 권역: ${tip.cheapPlaces.join(", ")}`,
      tip.dealReason,
      tip.caution,
      params.origin ? `출발지 ${params.origin} 기준` : "출발지 미입력",
      params.destination
        ? `목적지 ${params.destination} 선택됨`
        : "목적지 미입력(어디든지)",
      ...travelRag,
    ];

    const prompt = buildScheduleInsightPrompt({
      ...params,
      ragContexts,
    });

    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        system: getScheduleSystemPrompt(),
        prompt,
        mode: "schedule",
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ insight: fallback, source: "fallback" });
    }

    const data = (await res.json()) as {
      content?: string | null;
      source?: string;
    };
    const content = data.content?.trim();
    if (!content || data.source !== "ai") {
      return NextResponse.json({ insight: fallback, source: "fallback" });
    }

    return NextResponse.json({ insight: content, source: "ai+rag" });
  } catch {
    return NextResponse.json(
      {
        insight: "선택한 일정 기준으로 항공·숙소 예산을 맞춰 드릴게요.",
        source: "fallback",
      },
      { status: 200 }
    );
  }
}
