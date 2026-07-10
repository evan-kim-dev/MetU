import { NextResponse } from "next/server";
import {
  buildLocalWeatherInsight,
  parseWeatherInsightJson,
} from "@/lib/ai/weather-insight";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";
import {
  buildWeatherPrompt,
  getWeatherSystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";
import { getMonthDealTip } from "@/lib/rag/monthDeals";
import type { TripWeatherDay } from "@/lib/weather/open-meteo";

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
    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ system, prompt, mode: "weather" }),
    });

    if (!res.ok) {
      return NextResponse.json({
        ...fallback,
        source: "fallback",
      });
    }

    const data = (await res.json()) as {
      content?: string | null;
      source?: string;
    };
    const parsed = data.content ? parseWeatherInsightJson(data.content) : null;

    if (!parsed) {
      return NextResponse.json({
        ...fallback,
        source: "fallback",
      });
    }

    return NextResponse.json({
      ...parsed,
      source: data.source === "ai" ? "ai" : "fallback",
    });
  } catch (error) {
    if (!(error instanceof BackendUnavailableError)) {
      /* ignore */
    }
    return NextResponse.json({
      ...fallback,
      source: "fallback",
    });
  }
}
