import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend/client";
import {
  buildScheduleInsightPrompt,
  getScheduleSystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";
import {
  buildLocalScheduleInsight,
  buildScheduleRagContexts,
  type ScheduleDateType,
} from "@/lib/ai/schedule-insight";
import { retrieveTravelSources } from "@/lib/rag/travelKnowledge";
import type { OnboardingForm } from "@/components/onboarding/types";

export async function POST(request: Request) {
  let fallback =
    "시즌 가성비 권역을 불러오는 중이에요. 잠시만 기다려 주세요.";

  try {
    const body = (await request.json()) as {
      origin?: string;
      destination?: string;
      dateType?: ScheduleDateType;
      startDate?: string;
      endDate?: string;
      flexibleYear?: number;
      flexibleMonth?: number;
      budget?: number | string;
      people?: number;
    };

    const budgetRaw =
      typeof body.budget === "string"
        ? Number(body.budget.replace(/[^0-9]/g, "")) || 0
        : typeof body.budget === "number"
          ? body.budget
          : 0;

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
      budget: budgetRaw,
      people:
        typeof body.people === "number" && body.people >= 1
          ? body.people
          : 1,
    };

    fallback = buildLocalScheduleInsight(params);

    const seasonMonth =
      params.dateType === "specific" && params.startDate
        ? Number(params.startDate.slice(5, 7)) || params.flexibleMonth
        : params.flexibleMonth;

    const form: OnboardingForm = {
      origin: params.origin || "서울",
      destination: params.destination || "어디든지",
      budget: String(params.budget || 1_000_000),
      people: params.people,
      dateType: params.dateType,
      startDate: params.startDate,
      endDate: params.endDate,
      flexibleMonth: seasonMonth,
      flexibleYear: params.flexibleYear,
      styles: [],
    };
    const travelRag = retrieveTravelSources(form, 3).map((item) => item.content);

    const ragContexts = [
      ...buildScheduleRagContexts(params),
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
        insight: fallback,
        source: "fallback",
      },
      { status: 200 }
    );
  }
}
