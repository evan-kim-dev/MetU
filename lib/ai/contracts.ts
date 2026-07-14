/**
 * AI wire-format contracts — mirrors backend/app/schemas/ai_outputs.py
 * Soft parsers (no Zod) so BFF can still fall back when LLM drifts.
 */

export type AiMode =
  | "budget"
  | "party"
  | "deal"
  | "weather"
  | "factbomb"
  | "tips"
  | "style"
  | "schedule"
  | "plan"
  | "deals"
  | "summary"
  | "buddy";

export const JSON_AI_MODES: ReadonlySet<AiMode> = new Set([
  "plan",
  "tips",
  "weather",
  "deals",
  "deal",
]);

/** Backend ChatResponse shape */
export type AiChatResponse = {
  content: string | null;
  source: "ai" | "fallback" | string;
  validated?: boolean;
  cached?: boolean;
};

// --- plan ---

export type PlanScheduleItemOut = {
  time: string;
  title: string;
  detail: string;
};

export type PlanDayScheduleOut = {
  day: number;
  label: string;
  items: PlanScheduleItemOut[];
};

export type PlanItineraryOut = {
  summary: string;
  flight: { airline: string; schedule: string; note: string };
  hotel: { name: string; area: string; note: string };
  dailySchedule: PlanDayScheduleOut[];
  tips: string[];
};

// --- tips ---

export type TipItemOut = {
  emoji: string;
  title: string;
  description: string;
};

export type TipsOut = { tips: TipItemOut[] };

// --- weather ---

export type WeatherOut = {
  summary: string;
  preparation: string[];
};

// --- deals ---

export type DealRowOut = {
  id: string;
  highlight: string;
};

export type DealsOut = { deals: DealRowOut[] };

export type DealEnrichOut = {
  summary: string;
  whyCheap: string[];
  budgetTips: string[];
  mustTry: string[];
  caution: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function asStringList(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function parseJsonContent(content: string): unknown | null {
  try {
    let text = content.trim();
    if (text.startsWith("```")) {
      text = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Soft-parse plan JSON (fields optional → caller merges with fallback). */
export function parsePlanItinerary(content: string): Partial<PlanItineraryOut> | null {
  const root = asRecord(parseJsonContent(content));
  if (!root) return null;

  const flightRaw = asRecord(root.flight);
  const hotelRaw = asRecord(root.hotel);
  const daysRaw = Array.isArray(root.dailySchedule) ? root.dailySchedule : [];

  const dailySchedule: PlanDayScheduleOut[] = [];
  for (const day of daysRaw) {
    const d = asRecord(day);
    if (!d) continue;
    const dayNum = typeof d.day === "number" ? d.day : Number(d.day);
    if (!Number.isFinite(dayNum)) continue;
    const itemsRaw = Array.isArray(d.items) ? d.items : [];
    const items: PlanScheduleItemOut[] = [];
    for (const item of itemsRaw) {
      const it = asRecord(item);
      if (!it) continue;
      const time = asString(it.time);
      const title = asString(it.title);
      const detail = asString(it.detail);
      if (!time || !title) continue;
      items.push({ time, title, detail: detail || title });
    }
    dailySchedule.push({
      day: dayNum,
      label: asString(d.label) || `${dayNum}일차`,
      items,
    });
  }

  return {
    summary: asString(root.summary) || undefined,
    flight: flightRaw
      ? {
          airline: asString(flightRaw.airline) || "",
          schedule: asString(flightRaw.schedule) || "",
          note: asString(flightRaw.note) || "",
        }
      : undefined,
    hotel: hotelRaw
      ? {
          name: asString(hotelRaw.name) || "",
          area: asString(hotelRaw.area) || "",
          note: asString(hotelRaw.note) || "",
        }
      : undefined,
    dailySchedule: dailySchedule.length > 0 ? dailySchedule : undefined,
    tips: asStringList(root.tips, 10),
  };
}

export function parseTipsOut(content: string): TipsOut | null {
  const root = asRecord(parseJsonContent(content));
  if (!root || !Array.isArray(root.tips) || root.tips.length === 0) return null;

  const tips: TipItemOut[] = [];
  for (const tip of root.tips.slice(0, 10)) {
    const t = asRecord(tip);
    if (!t) continue;
    const description = asString(t.description);
    if (!description) continue;
    tips.push({
      emoji: asString(t.emoji) || "💡",
      title: asString(t.title) || "팁",
      description,
    });
  }
  return tips.length > 0 ? { tips } : null;
}

export function parseWeatherOut(content: string): WeatherOut | null {
  const root = asRecord(parseJsonContent(content));
  if (!root) return null;
  const summary = asString(root.summary);
  const preparation = asStringList(root.preparation, 8);
  if (!summary || preparation.length === 0) return null;
  return { summary, preparation };
}

export function parseDealsOut(content: string): DealsOut | null {
  const root = asRecord(parseJsonContent(content));
  if (!root || !Array.isArray(root.deals)) return null;
  const deals: DealRowOut[] = [];
  for (const row of root.deals.slice(0, 20)) {
    const r = asRecord(row);
    if (!r) continue;
    const id = asString(r.id);
    const highlight = asString(r.highlight);
    if (!id || !highlight) continue;
    deals.push({ id, highlight });
  }
  return deals.length > 0 ? { deals } : null;
}

export function parseDealEnrichOut(content: string): Partial<DealEnrichOut> | null {
  const root = asRecord(parseJsonContent(content));
  if (!root) return null;
  return {
    summary: asString(root.summary) || undefined,
    whyCheap: asStringList(root.whyCheap, 8),
    budgetTips: asStringList(root.budgetTips, 8),
    mustTry: asStringList(root.mustTry, 8),
    caution: asString(root.caution) || undefined,
  };
}
