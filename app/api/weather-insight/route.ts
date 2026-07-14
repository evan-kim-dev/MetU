import { NextResponse } from "next/server";
import {
  buildLocalWeatherInsight,
  parseWeatherInsightJson,
} from "@/lib/ai/weather-insight";
import { aiChatOrNull } from "@/lib/ai/chat-client";
import {
  buildWeatherPrompt,
  getWeatherSystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";
import { getMonthDealTip } from "@/lib/rag/monthDeals";
import type { TripWeatherDay } from "@/lib/weather/open-meteo";

export const maxDuration = 120;
interface WeatherInsightRequest {
  destination?: string;
  country?: string;
  dateLabel?: string;
  startDate?: string;
  endDate?: string;
  days?: TripWeatherDay[];
}

export async function POST(request: Request) {
  let body: WeatherInsightRequest;
  try {
    body = (await request.json()) as WeatherInsightRequest;
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const destination = body.destination?.trim() ?? "";
  const country = body.country?.trim() ?? "";
  const dateLabel = body.dateLabel?.trim() ?? "";
  const startDate = body.startDate?.trim() ?? "";
  const endDate = body.endDate?.trim() ?? "";
  const days = Array.isArray(body.days) ? body.days : [];

  if (!destination || !startDate || !endDate || days.length === 0) {
    return NextResponse.json({ error: "invalid-params" }, { status: 400 });
  }

  const month = Number(startDate.slice(5, 7)) || new Date().getMonth() + 1;
  const monthTip = getMonthDealTip(month);
  const fallback = buildLocalWeatherInsight({ destination, days, month });

  const prompt = buildWeatherPrompt({
    destination,
    country,
    dateLabel,
    startDate,
    endDate,
    month,
    days,
    monthCaution: monthTip.caution,
  });
  const system = getWeatherSystemPrompt();

  try {
    const chat = await aiChatOrNull({ mode: "weather", system, prompt });
    const parsed = chat ? parseWeatherInsightJson(chat.content) : null;

    if (!parsed) {
      return NextResponse.json({
        ...fallback,
        source: "fallback",
      });
    }

    return NextResponse.json({
      ...parsed,
      source: "ai",
    });
  } catch {
    return NextResponse.json({
      ...fallback,
      source: "fallback",
    });
  }
}
