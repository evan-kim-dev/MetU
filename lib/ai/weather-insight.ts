import { getMonthDealTip } from "@/lib/rag/monthDeals";
import type { TripWeatherDay } from "@/lib/weather/open-meteo";

export interface WeatherInsightResult {
  summary: string;
  preparation: string[];
}

export function parseWeatherInsightJson(text: string): WeatherInsightResult | null {
  try {
    const parsed = JSON.parse(text) as {
      summary?: unknown;
      preparation?: unknown;
    };
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.preparation)) {
      return null;
    }
    const preparation = parsed.preparation
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
    const summary = parsed.summary.trim();
    if (!summary || preparation.length === 0) return null;
    return { summary, preparation };
  } catch {
    return null;
  }
}

export function buildLocalWeatherInsight(params: {
  destination: string;
  days: TripWeatherDay[];
  month: number;
}): WeatherInsightResult {
  const { destination, days, month } = params;
  const tip = getMonthDealTip(month);

  if (days.length === 0) {
    return {
      summary: `${destination} 여행 날씨를 분석하려면 여행 일정이 필요해요.`,
      preparation: ["여행 일정을 등록하면 맞춤 대비 팁을 보여드려요."],
    };
  }

  const hasRain = days.some((day) =>
    /비|소나기|천둥|이슬비/.test(day.description)
  );
  const hasCold = days.some((day) => day.minC < 10);
  const hasHot = days.some((day) => day.maxC > 30);
  const avgMax = Math.round(
    days.reduce((sum, day) => sum + day.maxC, 0) / days.length
  );
  const avgMin = Math.round(
    days.reduce((sum, day) => sum + day.minC, 0) / days.length
  );
  const sourceLabel =
    days[0]?.source === "forecast"
      ? "단기 예보"
      : `${month}월 평균 기후(최근 5년)`;

  const preparation: string[] = [];
  if (hasRain) preparation.push("우산·방수 재킷·여분 양말을 챙기세요.");
  if (hasCold) preparation.push("겹쳐 입을 수 있는 외투와 목도리를 준비하세요.");
  if (hasHot) preparation.push("선크림·모자·수분 보충용 물병을 챙기세요.");
  if (preparation.length === 0) {
    preparation.push("가벼운 겉옷과 편한 신발을 준비하세요.");
  }
  preparation.push(tip.caution.replace(/^다만\s*/, ""));

  const rainNote = hasRain ? `${month}월에는 비가 잦을 수 있어요. ` : "";
  const summary = `${destination} ${month}월 여행 ${days.length}일은 ${sourceLabel} 기준으로 낮 ${avgMax}°, 밤 ${avgMin}° 전후예요. ${rainNote}${tip.caution}`;

  return {
    summary,
    preparation: preparation.slice(0, 4),
  };
}
