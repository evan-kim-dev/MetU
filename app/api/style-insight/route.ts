import { NextResponse } from "next/server";
import { aiChatOrNull } from "@/lib/ai/chat-client";
import {
  buildStyleInsightPrompt,
  getStyleSystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";
import { retrieveTravelSources } from "@/lib/rag/travelKnowledge";
import { STYLE_LABELS } from "@/lib/trips/data";
import type { OnboardingForm, TravelStyle } from "@/components/onboarding/types";

export const maxDuration = 90;

function buildLocalStyleInsight(styles: TravelStyle[]): string {
  const labels = styles.map((s) => STYLE_LABELS[s] ?? s);
  if (labels.length === 0) {
    return "관심 스타일을 고르면 맞춤 코스를 짜드릴게요.";
  }
  return `선택하신 ${labels.join("·")} 스타일을 반영해 맞춤 코스를 짜드릴게요.`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { styles?: TravelStyle[] };
    const styles = Array.isArray(body.styles) ? body.styles : [];
    const fallback = buildLocalStyleInsight(styles);

    if (styles.length === 0) {
      return NextResponse.json({ insight: fallback, source: "local" });
    }

    const form: OnboardingForm = {
      styles,
      origin: "서울",
      destination: "도쿄",
      budget: "1000000",
      people: 1,
      dateType: "flexible",
      startDate: "",
      endDate: "",
      flexibleMonth: new Date().getMonth() + 1,
      flexibleYear: new Date().getFullYear(),
    };

    const rag = retrieveTravelSources(form, 8);
    const prompt = buildStyleInsightPrompt({
      styles,
      styleLabels: styles.map((s) => STYLE_LABELS[s] ?? s),
      ragContexts: rag.map((item) => item.content),
    });

    const chat = await aiChatOrNull({
      mode: "style",
      system: getStyleSystemPrompt(),
      prompt,
    });
    if (!chat) {
      return NextResponse.json({ insight: fallback, source: "fallback" });
    }

    return NextResponse.json({
      insight: chat.content,
      source: "ai+rag",
    });
  } catch {
    return NextResponse.json(
      {
        insight: "선택하신 스타일을 반영해 맞춤 코스를 짜드릴게요.",
        source: "fallback",
      },
      { status: 200 }
    );
  }
}
