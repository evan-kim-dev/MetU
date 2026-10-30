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
  | "buddy"
  | "itinerary"
  | "itinerary_patch"
  | "expense_parse"
  | "expense_text"
  | "receipt_vision";

export const JSON_AI_MODES: ReadonlySet<AiMode> = new Set([
  "plan",
  "tips",
  "weather",
  "deals",
  "deal",
  "itinerary",
  "itinerary_patch",
  "expense_parse",
  "expense_text",
  "receipt_vision",
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
  name: string;
  country: string;
  bestMonth: string;
  highlight: string;
  /** 가성비 / 보통 / 프리미엄 (또는 value/standard/premium) */
  tier: string;
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
  for (const row of root.deals.slice(0, 12)) {
    const r = asRecord(row);
    if (!r) continue;
    const name = asString(r.name);
    const country = asString(r.country);
    const highlight = asString(r.highlight);
    if (!name || !country || !highlight) continue;
    // Ignore any numeric price fields the model may invent — do not surface them
    deals.push({
      name,
      country,
      bestMonth: asString(r.bestMonth) || "",
      highlight,
      tier: asString(r.tier) || "보통",
    });
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

export type ItinerarySlot =
  | "morning"
  | "lunch"
  | "afternoon"
  | "dinner"
  | "evening";

export type ItineraryItemOut = {
  placeId: string;
  slot: ItinerarySlot;
  durationMin: number;
  reason: string;
};

export type ItineraryDayOut = {
  day: number;
  theme: string;
  items: ItineraryItemOut[];
};

export type ItineraryOut = {
  summary: string;
  days: ItineraryDayOut[];
};

const SLOTS = new Set<ItinerarySlot>([
  "morning",
  "lunch",
  "afternoon",
  "dinner",
  "evening",
]);

export function parseItinerary(content: string): ItineraryOut | null {
  const root = asRecord(parseJsonContent(content));
  if (!root || !Array.isArray(root.days)) return null;
  const days: ItineraryDayOut[] = [];
  for (const day of root.days) {
    const d = asRecord(day);
    if (!d) continue;
    const dayNum = typeof d.day === "number" ? d.day : Number(d.day);
    if (!Number.isFinite(dayNum)) continue;
    const items: ItineraryItemOut[] = [];
    for (const raw of Array.isArray(d.items) ? d.items : []) {
      const it = asRecord(raw);
      if (!it) continue;
      const placeId = asString(it.placeId);
      const slotRaw = asString(it.slot);
      const durationMin =
        typeof it.durationMin === "number"
          ? it.durationMin
          : Number(it.durationMin);
      if (!placeId || !slotRaw || !SLOTS.has(slotRaw as ItinerarySlot)) continue;
      if (!Number.isFinite(durationMin)) continue;
      items.push({
        placeId,
        slot: slotRaw as ItinerarySlot,
        durationMin,
        reason: asString(it.reason) || "",
      });
    }
    if (items.length < 3) continue;
    days.push({
      day: dayNum,
      theme: asString(d.theme) || `${dayNum}일차`,
      items,
    });
  }
  if (!days.length) return null;
  return { summary: asString(root.summary) || "", days };
}

export type PatchOpKind = "replace" | "remove" | "add" | "move";

export type PatchOp = {
  op: PatchOpKind;
  day: number;
  index?: number | null;
  newPlaceId?: string | null;
  toDay?: number | null;
  toIndex?: number | null;
  slot?: ItinerarySlot | null;
};

export type ItineraryPatchOut = {
  ops: PatchOp[];
  explanation: string;
  needsClarification?: string | null;
};

export function parseItineraryPatch(content: string): ItineraryPatchOut | null {
  const root = asRecord(parseJsonContent(content));
  if (!root) return null;
  const opsRaw = Array.isArray(root.ops) ? root.ops : [];
  const ops: PatchOp[] = [];
  for (const raw of opsRaw.slice(0, 8)) {
    const o = asRecord(raw);
    if (!o) continue;
    const op = asString(o.op);
    if (
      op !== "replace" &&
      op !== "remove" &&
      op !== "add" &&
      op !== "move"
    ) {
      continue;
    }
    const day = typeof o.day === "number" ? o.day : Number(o.day);
    if (!Number.isFinite(day)) continue;
    const slotRaw = asString(o.slot);
    ops.push({
      op,
      day,
      index:
        o.index === null || o.index === undefined
          ? undefined
          : typeof o.index === "number"
            ? o.index
            : Number(o.index),
      newPlaceId: asString(o.newPlaceId) ?? undefined,
      toDay:
        o.toDay === null || o.toDay === undefined
          ? undefined
          : typeof o.toDay === "number"
            ? o.toDay
            : Number(o.toDay),
      toIndex:
        o.toIndex === null || o.toIndex === undefined
          ? undefined
          : typeof o.toIndex === "number"
            ? o.toIndex
            : Number(o.toIndex),
      slot:
        slotRaw && SLOTS.has(slotRaw as ItinerarySlot)
          ? (slotRaw as ItinerarySlot)
          : undefined,
    });
  }
  return {
    ops,
    explanation: asString(root.explanation) || "",
    needsClarification: asString(root.needsClarification) ?? undefined,
  };
}

// --- expense_parse ---

export type ExpenseCategoryOut =
  | "식비"
  | "교통"
  | "숙소"
  | "관광"
  | "쇼핑"
  | "기타";

export type ExpenseParseItemOut = {
  label: string;
  amount: number;
  currency: string;
  paidByMemberId: string | null;
  participantIds: string[] | null;
  category: ExpenseCategoryOut;
  placeId: string | null;
  spentOn: string | null;
  confidence: number;
};

export type ExpenseParseOut = {
  items: ExpenseParseItemOut[];
  needsClarification?: string | null;
};

const EXPENSE_CATEGORIES = new Set<ExpenseCategoryOut>([
  "식비",
  "교통",
  "숙소",
  "관광",
  "쇼핑",
  "기타",
]);

export function parseExpenseParseOut(content: string): ExpenseParseOut | null {
  const root = asRecord(parseJsonContent(content));
  if (!root) return null;
  const itemsRaw = Array.isArray(root.items) ? root.items : [];
  const items: ExpenseParseItemOut[] = [];
  for (const row of itemsRaw.slice(0, 10)) {
    const r = asRecord(row);
    if (!r) continue;
    const label = asString(r.label);
    const amount =
      typeof r.amount === "number" ? r.amount : Number(r.amount);
    const currency = asString(r.currency)?.toUpperCase();
    const categoryRaw = asString(r.category);
    if (!label || !Number.isFinite(amount) || amount <= 0 || !currency) continue;
    const category = EXPENSE_CATEGORIES.has(categoryRaw as ExpenseCategoryOut)
      ? (categoryRaw as ExpenseCategoryOut)
      : "기타";
    const confidence =
      typeof r.confidence === "number" ? r.confidence : Number(r.confidence);
    items.push({
      label,
      amount,
      currency,
      paidByMemberId: asString(r.paidByMemberId),
      participantIds: Array.isArray(r.participantIds)
        ? r.participantIds.filter((id): id is string => typeof id === "string")
        : null,
      category,
      placeId: asString(r.placeId),
      spentOn: asString(r.spentOn),
      confidence: Number.isFinite(confidence) ? confidence : 0.5,
    });
  }
  return {
    items,
    needsClarification: asString(root.needsClarification) ?? null,
  };
}

// --- expense_text ---

export type ExpenseTextOut = {
  isExpense: boolean;
  merchant: string | null;
  merchantKo: string | null;
  amount: number | null;
  currency: string | null;
  spentDate: string | null;
  spentTime: string | null;
  category: ExpenseCategoryOut;
  paymentMethod: "card" | "cash" | "transfer" | null;
  payerName: string | null;
  participantNames: string[];
  splitHint: "equal" | "fixed" | "ratio" | null;
  confidence: number;
  warnings: string[];
};

export function parseExpenseTextOut(content: string): ExpenseTextOut | null {
  const root = asRecord(parseJsonContent(content));
  if (!root) return null;
  const categoryRaw = asString(root.category) ?? asString(root.Category);
  const category = EXPENSE_CATEGORIES.has(categoryRaw as ExpenseCategoryOut)
    ? (categoryRaw as ExpenseCategoryOut)
    : "기타";
  const amountRaw = root.amount;
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : amountRaw == null
        ? null
        : Number(amountRaw);
  const pm = asString(root.payment_method) ?? asString(root.paymentMethod);
  const split =
    asString(root.split_hint) ?? asString(root.splitHint);
  const confidenceRaw = root.confidence;
  const confidence =
    typeof confidenceRaw === "number"
      ? confidenceRaw
      : Number(confidenceRaw ?? 0.5);
  const names = Array.isArray(root.participant_names)
    ? root.participant_names
    : Array.isArray(root.participantNames)
      ? root.participantNames
      : [];
  const warnings = Array.isArray(root.warnings)
    ? root.warnings.filter((w): w is string => typeof w === "string")
    : [];

  return {
    isExpense: Boolean(root.is_expense ?? root.isExpense),
    merchant: asString(root.merchant),
    merchantKo: asString(root.merchant_ko) ?? asString(root.merchantKo),
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    currency: asString(root.currency)?.toUpperCase() ?? null,
    spentDate: asString(root.spent_date) ?? asString(root.spentDate),
    spentTime: asString(root.spent_time) ?? asString(root.spentTime),
    category,
    paymentMethod:
      pm === "card" || pm === "cash" || pm === "transfer" ? pm : null,
    payerName: asString(root.payer_name) ?? asString(root.payerName),
    participantNames: names.filter((n): n is string => typeof n === "string"),
    splitHint:
      split === "equal" || split === "fixed" || split === "ratio" ? split : null,
    confidence: Number.isFinite(confidence) ? confidence : 0.5,
    warnings,
  };
}

// --- receipt_vision ---

export type ReceiptItemOut = {
  name: string;
  nameKo: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
};

export type ReceiptOut = {
  isReceipt: boolean;
  merchant: string | null;
  merchantKo: string | null;
  paidAt: string | null;
  currency: string | null;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  items: ReceiptItemOut[];
  category: ExpenseCategoryOut;
  paymentMethod: "card" | "cash" | "transfer" | null;
  language: string | null;
  confidence: number;
  warnings: string[];
};

export function parseReceiptOut(content: string): ReceiptOut | null {
  const root = asRecord(parseJsonContent(content));
  if (!root) return null;

  const categoryRaw = asString(root.category);
  const category = EXPENSE_CATEGORIES.has(categoryRaw as ExpenseCategoryOut)
    ? (categoryRaw as ExpenseCategoryOut)
    : "기타";

  const pm = asString(root.payment_method) ?? asString(root.paymentMethod);
  const itemsRaw = Array.isArray(root.items) ? root.items : [];
  const items: ReceiptItemOut[] = [];
  for (const row of itemsRaw.slice(0, 40)) {
    const r = asRecord(row);
    if (!r) continue;
    const name = asString(r.name);
    if (!name) continue;
    const qty =
      typeof r.qty === "number" ? r.qty : r.qty == null ? null : Number(r.qty);
    const unitPrice =
      typeof r.unit_price === "number"
        ? r.unit_price
        : typeof r.unitPrice === "number"
          ? r.unitPrice
          : r.unit_price == null && r.unitPrice == null
            ? null
            : Number(r.unit_price ?? r.unitPrice);
    const amount =
      typeof r.amount === "number"
        ? r.amount
        : r.amount == null
          ? null
          : Number(r.amount);
    items.push({
      name,
      nameKo: asString(r.name_ko) ?? asString(r.nameKo),
      qty: qty != null && Number.isFinite(qty) ? qty : null,
      unitPrice:
        unitPrice != null && Number.isFinite(unitPrice) ? unitPrice : null,
      amount: amount != null && Number.isFinite(amount) ? amount : null,
    });
  }

  const totalRaw = root.total;
  const total =
    typeof totalRaw === "number"
      ? totalRaw
      : totalRaw == null
        ? null
        : Number(totalRaw);
  const confidenceRaw = root.confidence;
  const confidence =
    typeof confidenceRaw === "number"
      ? confidenceRaw
      : Number(confidenceRaw ?? 0.5);
  const warnings = Array.isArray(root.warnings)
    ? root.warnings.filter((w): w is string => typeof w === "string").slice(0, 5)
    : [];

  return {
    isReceipt: Boolean(root.is_receipt ?? root.isReceipt),
    merchant: asString(root.merchant),
    merchantKo: asString(root.merchant_ko) ?? asString(root.merchantKo),
    paidAt: asString(root.paid_at) ?? asString(root.paidAt),
    currency: asString(root.currency)?.toUpperCase() ?? null,
    total: total != null && Number.isFinite(total) ? total : null,
    subtotal:
      typeof root.subtotal === "number"
        ? root.subtotal
        : root.subtotal == null
          ? null
          : Number(root.subtotal),
    tax:
      typeof root.tax === "number"
        ? root.tax
        : root.tax == null
          ? null
          : Number(root.tax),
    tip:
      typeof root.tip === "number"
        ? root.tip
        : root.tip == null
          ? null
          : Number(root.tip),
    items,
    category,
    paymentMethod:
      pm === "card" || pm === "cash" || pm === "transfer" ? pm : null,
    language: asString(root.language),
    confidence: Number.isFinite(confidence) ? confidence : 0.5,
    warnings,
  };
}
