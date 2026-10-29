import { NextResponse } from "next/server";
import { aiChatOrNull } from "@/lib/ai/chat-client";
import { parseItineraryPatch } from "@/lib/ai/contracts";
import { buildCandidatePool } from "@/lib/places/candidates";
import type { TravelStyle } from "@/lib/onboarding/types";
import type { TripDaySchedule } from "@/lib/trips/types";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 90;

type PatchBody = {
  instruction?: string;
  city?: string;
  country?: string;
  styles?: string[];
  nights?: number;
  dailySchedule?: TripDaySchedule[];
};

function withItemIndexes(days: TripDaySchedule[]) {
  return days.map((day) => ({
    day: day.day,
    label: day.label,
    items: day.items.map((item, index) => ({
      ...item,
      index,
    })),
  }));
}

function toCandidatePayload(p: {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  rating?: number;
  priceLevel?: string;
  provider?: string;
  openingHours?: unknown;
  address?: string;
}) {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    lat: p.lat,
    lng: p.lng,
    rating: p.rating ?? null,
    priceLevel: p.priceLevel ?? null,
    provider: p.provider ?? null,
    hoursKnown: Boolean(
      p.openingHours &&
        Array.isArray(p.openingHours) &&
        p.openingHours.length > 0
    ),
    area: p.address?.split(/\s+/)[0] ?? null,
  };
}

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ai" });
  if (guard instanceof NextResponse) return guard;

  try {
    const body = (await request.json()) as PatchBody;
    const instruction = body.instruction?.trim();
    const city = body.city?.trim();
    const dailySchedule = body.dailySchedule ?? [];

    if (!instruction || !city || dailySchedule.length === 0) {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }

    const styles = (body.styles ?? []) as TravelStyle[];
    const nights =
      typeof body.nights === "number" && body.nights >= 1
        ? body.nights
        : Math.max(1, dailySchedule.length - 1);

    const pool = await buildCandidatePool({
      city,
      country: body.country,
      styles,
      nights,
    });

    const candidates = pool.places.slice(0, 80).map(toCandidatePayload);

    const chat = await aiChatOrNull({
      mode: "itinerary_patch",
      clientKey: guard.clientKey,
      system:
        "현재 일정을 사용자 지시에 맞게 수정한 JSON만 출력하세요. 후보 placeId만 사용하세요.",
      prompt: JSON.stringify({
        instruction,
        city,
        currentDays: withItemIndexes(dailySchedule),
        candidates,
      }),
    });

    const parsed = chat?.content ? parseItineraryPatch(chat.content) : null;
    if (!parsed) {
      return NextResponse.json({ error: "patch-parse-failed" }, { status: 502 });
    }

    const candidateMeta = pool.places.slice(0, 80).map((p) => ({
      id: p.id || `${p.provider}:${p.providerPlaceId}`,
      name: p.name,
      kind: p.kind,
      lat: p.lat,
      lng: p.lng,
      provider: p.provider,
      providerPlaceId: p.providerPlaceId,
      hoursKnown: p.openingHours != null,
      detailUrl: p.mapsUri,
      address: p.address,
    }));

    return NextResponse.json({
      ...parsed,
      source: chat?.source ?? "fallback",
      validated: Boolean(chat?.validated),
      candidates: candidateMeta,
    });
  } catch (error) {
    console.error("[itinerary/patch]", error);
    return NextResponse.json({ error: "patch-failed" }, { status: 500 });
  }
}
