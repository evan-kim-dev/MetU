import "server-only";

import type { TravelStyle } from "@/lib/onboarding/types";
import type { DaySchedule } from "@/lib/ai/types";
import { parseItinerary, type ItinerarySlot } from "@/lib/ai/contracts";
import { buildScheduleFromCandidates } from "@/lib/places/candidate-schedule";
import { getPlacesByIds } from "@/lib/places/cache";
import type { Place, PlaceKind, OpeningPeriod } from "@/lib/places/types";
import { regionOf } from "@/lib/geo/region";
import {
  defaultDayConstraints,
  durationMinForKind,
  evaluateOrder,
  solveDay,
  type SolverStop,
} from "@/lib/route/schedule-solver";
import { getTravelMatrix, refineLegsForOrder } from "@/lib/route/travel-matrix";
import { aiChatOrNull } from "@/lib/ai/chat-client";

const MIN_CANDIDATE_POOL = 8;
const REFINE_RESOLVE_THRESHOLD = 0.2;

function priceWeight(priceLevel?: string): number {
  if (!priceLevel) return 1;
  if (priceLevel.includes("INEXPENSIVE") || priceLevel.includes("FREE"))
    return 0.7;
  if (priceLevel.includes("MODERATE")) return 1;
  if (priceLevel.includes("EXPENSIVE")) return 1.3;
  if (priceLevel.includes("VERY_EXPENSIVE")) return 1.6;
  return 1;
}

function openingForSolver(
  periods: OpeningPeriod[] | undefined
): Array<{ open: string; close: string }> | undefined {
  if (!periods?.length) return undefined;
  return periods.map((p) => ({ open: p.open, close: p.close }));
}

function itemCost(
  kind: PlaceKind,
  slot: ItinerarySlot,
  budgets: { food: number; activity: number; transport: number },
  priceLevel?: string
): number {
  const w = priceWeight(priceLevel);
  if (slot === "lunch" || slot === "dinner") {
    return Math.round((budgets.food / 2) * w);
  }
  if (kind === "food" || kind === "cafe") {
    return Math.round((budgets.food / 2) * w);
  }
  return Math.round((budgets.activity / 3) * w);
}

function toCandidatePayload(p: Place) {
  return {
    id: p.id || `${p.provider}:${p.providerPlaceId}`,
    name: p.name,
    kind: p.kind,
    lat: p.lat,
    lng: p.lng,
    rating: p.rating ?? null,
    priceLevel: p.priceLevel ?? null,
    provider: p.provider,
    hoursKnown: Boolean(p.openingHours?.length),
    area: p.address?.split(/\s+/)[0] ?? null,
  };
}

function sortItemsByTime<T extends { time: string }>(items: T[]): T[] {
  const toMin = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    if (!m) return 0;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  return [...items].sort((a, b) => toMin(a.time) - toMin(b.time));
}

function placeToScheduleItem(
  place: Place,
  time: string,
  slot: ItinerarySlot,
  reason: string,
  budgets: { food: number; activity: number; transport: number }
): DaySchedule["items"][number] {
  return {
    time,
    title: place.name,
    detail: reason.trim() || place.address || place.categoryName || undefined,
    cost: itemCost(place.kind, slot, budgets, place.priceLevel),
    placeId: place.id || undefined,
    provider: place.provider,
    providerPlaceId: place.providerPlaceId,
    hoursKnown: place.openingHours != null,
    detailUrl: place.mapsUri,
    lat: place.lat,
    lng: place.lng,
    durationMin: durationMinForKind(place.kind),
    kind: place.kind,
  };
}

async function solveDayPlaces(
  dayItems: Array<{
    placeId: string;
    slot: ItinerarySlot;
    durationMin: number;
    reason: string;
  }>,
  placeById: Map<string, Place>,
  region: "KR" | "GLOBAL",
  budgets: { food: number; activity: number; transport: number }
): Promise<DaySchedule["items"]> {
  const stops: SolverStop[] = [];
  const meta: typeof dayItems = [];

  for (const item of dayItems) {
    const place = placeById.get(item.placeId);
    if (!place) continue;
    stops.push({
      id: place.id || item.placeId,
      lat: place.lat,
      lng: place.lng,
      kind: place.kind,
      durationMin: durationMinForKind(place.kind, item.durationMin),
      opening: openingForSolver(place.openingHours),
      hoursKnown: Boolean(place.openingHours?.length),
    });
    meta.push(item);
  }

  if (!stops.length) return [];

  const points = stops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng }));
  let matrix = await getTravelMatrix(points, "TRANSIT", { region });
  const constraints = defaultDayConstraints();
  let plan = solveDay(stops, matrix.durationsSec, constraints);

  if (region === "KR" && stops.length >= 2) {
    const indexOrder = plan.order.map((id) =>
      stops.findIndex((s) => s.id === id)
    );
    const refined = await refineLegsForOrder(
      matrix,
      points,
      indexOrder.filter((i) => i >= 0)
    );
    const before = plan.totalTravelMin;
    const after = Math.round(
      evaluateOrder(
        indexOrder.filter((i) => i >= 0),
        stops,
        refined.durationsSec,
        constraints
      ).timetable.reduce((s, t) => s + t.travelFromPrevMin, 0)
    );
    matrix = refined;
    if (
      before > 0 &&
      Math.abs(after - before) / before > REFINE_RESOLVE_THRESHOLD
    ) {
      plan = solveDay(stops, matrix.durationsSec, constraints);
    } else {
      const evaluated = evaluateOrder(
        indexOrder.filter((i) => i >= 0),
        stops,
        matrix.durationsSec,
        constraints
      );
      plan = {
        ...plan,
        timetable: evaluated.timetable,
        totalTravelMin: after,
        totalViolations: evaluated.violations,
      };
    }
  }

  const slotByStopId = new Map<string, ItinerarySlot>();
  const reasonByStopId = new Map<string, string>();
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]!;
    const m = meta[i]!;
    slotByStopId.set(stop.id, m.slot);
    reasonByStopId.set(stop.id, m.reason);
  }

  const out: DaySchedule["items"] = [];
  for (const entry of plan.timetable) {
    const place = placeById.get(entry.stopId);
    if (!place) continue;
    const slot = slotByStopId.get(entry.stopId) ?? "afternoon";
    out.push(
      placeToScheduleItem(
        place,
        entry.arrive,
        slot,
        reasonByStopId.get(entry.stopId) ?? "",
        budgets
      )
    );
    const last = out[out.length - 1]!;
    if (entry.travelFromPrevMin > 0) {
      out[out.length - 1] = {
        ...last,
        travelFromPrevMin: entry.travelFromPrevMin,
        warnings: entry.violations.length ? entry.violations : undefined,
      };
    }
  }

  return out;
}

export type GeneratePlaceItineraryResult = {
  schedule: DaySchedule[];
  source: "ai" | "fallback";
};

export async function generatePlaceItinerary(params: {
  city: string;
  country?: string;
  origin: string;
  nights: number;
  people: number;
  styles: TravelStyle[];
  budgets: { food: number; activity: number; transport: number };
  candidates: Place[];
  perPersonDailyBudgetKrw?: number;
  hotelArea?: string;
}): Promise<GeneratePlaceItineraryResult> {
  const fallback = (): GeneratePlaceItineraryResult => ({
    schedule: buildScheduleFromCandidates({
      places: params.candidates,
      nights: params.nights,
      styles: params.styles,
      budgets: params.budgets,
      city: params.city,
      origin: params.origin,
    }),
    source: "fallback",
  });

  if (params.candidates.length < MIN_CANDIDATE_POOL) {
    return fallback();
  }

  const candidatesPayload = params.candidates
    .filter((p) => p.id || p.providerPlaceId)
    .slice(0, 80)
    .map(toCandidatePayload);

  if (candidatesPayload.length < MIN_CANDIDATE_POOL) {
    return fallback();
  }

  const chat = await aiChatOrNull({
    mode: "itinerary",
    prompt: JSON.stringify({
      city: params.city,
      nights: params.nights,
      people: params.people,
      styles: params.styles,
      perPersonDailyBudgetKrw: params.perPersonDailyBudgetKrw ?? null,
      hotelArea: params.hotelArea ?? null,
      candidates: candidatesPayload,
    }),
    system:
      "후보 placeId만 사용해 일정 JSON을 만드세요. 새 장소를 지어내지 마세요.",
  });
  if (!chat?.content || chat.source !== "ai") {
    return fallback();
  }

  const parsed = parseItinerary(chat.content);
  if (!parsed || parsed.days.length !== params.nights + 1) {
    return fallback();
  }

  const ids = [
    ...new Set(parsed.days.flatMap((d) => d.items.map((i) => i.placeId))),
  ];
  const places = await getPlacesByIds(ids);
  const placeById = new Map<string, Place>();
  for (const p of places) {
    if (p.id) placeById.set(p.id, p);
  }
  for (const p of params.candidates) {
    if (p.id && !placeById.has(p.id)) placeById.set(p.id, p);
  }

  const template = buildScheduleFromCandidates({
    places: params.candidates,
    nights: params.nights,
    styles: params.styles,
    budgets: params.budgets,
    city: params.city,
    origin: params.origin,
  });

  const region = regionOf({
    country: params.country,
    destination: params.city,
  });

  const schedule: DaySchedule[] = [];
  for (const aiDay of parsed.days) {
    const templateDay = template.find((d) => d.day === aiDay.day);
    const fixedItems =
      templateDay?.items.filter((item) => item.fixed) ?? [];

    const placeItems = await solveDayPlaces(
      aiDay.items,
      placeById,
      region,
      params.budgets
    );

    const items = sortItemsByTime([...fixedItems, ...placeItems]);
    const dayTotal = items.reduce((s, it) => s + (it.cost || 0), 0);
    schedule.push({
      day: aiDay.day,
      label: aiDay.theme || templateDay?.label || `${aiDay.day}일차`,
      items,
      dayTotal,
    });
  }

  if (!schedule.length) return fallback();
  return { schedule, source: "ai" };
}
