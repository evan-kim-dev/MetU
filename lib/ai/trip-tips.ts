import type { SmartTip } from "@/lib/mock/home";
import type { Trip } from "@/lib/trips/types";
import { retrieveBudgetRag } from "@/lib/rag/budgetBands";
import { STYLE_LABELS } from "@/lib/trips/data";
import { buildTipsForTrip } from "@/lib/tips/buildTipsForTrip";
import {
  buildTripTipsPrompt,
  getTipsSystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";
import { backendFetch } from "@/lib/backend/client";

function collectRagContexts(trip: Trip | null): string[] {
  if (!trip) {
    return [
      "예산대를 먼저 정하면 항공·숙소 저가 노선 중심으로 후보를 좁힐 수 있어요.",
      "날짜를 유연하게 두면 주중 출발 항공을 찾아 더 저렴하게 갈 수 있어요.",
      "맛집·힐링·핫플 등 스타일 키워드만 골라도 맞춤 일정이 만들어져요.",
    ];
  }

  const perPerson =
    trip.people > 0 ? Math.floor(trip.budget / trip.people) : trip.budget;
  const month = new Date().getMonth() + 1;
  const budgetRag = retrieveBudgetRag(perPerson || 800_000, month);
  const styleHints = trip.styles
    .slice(0, 3)
    .map((style) => STYLE_LABELS[style] ?? style)
    .join(", ");

  return [
    ...budgetRag.contexts,
    budgetRag.seasonTip,
    styleHints ? `선택 스타일: ${styleHints}` : "스타일 미선택",
    `${trip.destination} ${trip.country} 여행 준비 팁이 필요함`,
  ];
}

function parseAiTips(
  content: string,
  tripId: string
): SmartTip[] | null {
  try {
    const parsed = JSON.parse(content) as {
      tips?: Array<{ emoji?: string; title?: string; description?: string }>;
    };
    if (!Array.isArray(parsed.tips) || parsed.tips.length === 0) return null;

    return parsed.tips.slice(0, 6).map((tip, index) => ({
      id: `tip-ai-${tripId}-${index}`,
      emoji: tip.emoji?.trim() || "💡",
      title: tip.title?.trim() || `팁 ${index + 1}`,
      description: tip.description?.trim() || "",
    })).filter((tip) => tip.description.length > 0);
  } catch {
    return null;
  }
}

export async function resolveTripTipsWithAi(
  trip: Trip | null | undefined
): Promise<{ tips: SmartTip[]; source: "ai+rag" | "local" }> {
  const fallback = buildTipsForTrip(trip);
  const ragContexts = collectRagContexts(trip ?? null);

  const prompt = buildTripTipsPrompt({
    destination: trip?.destination ?? "미정",
    country: trip?.country ?? "",
    dateRange: trip?.dateRange ?? "",
    dDay: trip?.dDay ?? 0,
    budget: trip?.budget ?? 0,
    spent: trip?.spent ?? 0,
    people: trip?.people ?? 1,
    styles: trip?.styles ?? [],
    ragContexts,
  });

  try {
    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        system: getTipsSystemPrompt(),
        prompt,
        mode: "tips",
      }),
    });
    if (!res.ok) return { tips: fallback, source: "local" };

    const data = (await res.json()) as {
      content?: string | null;
      source?: string;
    };
    if (!data.content || data.source !== "ai") {
      return { tips: fallback, source: "local" };
    }

    const aiTips = parseAiTips(data.content, trip?.id ?? "empty");
    if (!aiTips || aiTips.length === 0) {
      return { tips: fallback, source: "local" };
    }

    return { tips: aiTips, source: "ai+rag" };
  } catch {
    return { tips: fallback, source: "local" };
  }
}
