import type { ItinerarySlot, PatchOp } from "@/lib/ai/contracts";
import type { PlaceKind } from "@/lib/places/types";
import type { TripDaySchedule, TripScheduleItem } from "@/lib/trips/types";
import { moveItem } from "@/lib/route/recompute-day";

export type PatchScheduleCandidate = {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  provider?: "kakao" | "google";
  providerPlaceId?: string;
  hoursKnown?: boolean;
  detailUrl?: string;
  address?: string;
};

const SLOT_TIME: Record<ItinerarySlot, string> = {
  morning: "09:30",
  lunch: "12:00",
  afternoon: "14:00",
  dinner: "18:30",
  evening: "20:00",
};

function isFixedItem(item: TripScheduleItem): boolean {
  if (item.fixed) return true;
  const t = item.title.toLowerCase();
  return /체크인|체크아웃|공항|항공|비행|airport|출국|입국/.test(t);
}

function recalcDay(day: TripDaySchedule): TripDaySchedule {
  return {
    ...day,
    dayTotal: day.items.reduce((s, i) => s + (i.cost || 0), 0),
  };
}

function candidateToItem(
  c: PatchScheduleCandidate,
  time: string
): TripScheduleItem {
  return {
    time,
    title: c.name,
    detail: c.address,
    cost: 0,
    placeId: c.id,
    provider: c.provider,
    providerPlaceId: c.providerPlaceId,
    hoursKnown: c.hoursKnown,
    detailUrl: c.detailUrl,
    lat: c.lat,
    lng: c.lng,
    kind: c.kind,
  };
}

function defaultTimeForAdd(
  slot: ItinerarySlot | undefined,
  day: TripDaySchedule,
  index: number
): string {
  if (slot && SLOT_TIME[slot]) return SLOT_TIME[slot];
  const neighbor = day.items[index]?.time ?? day.items[index - 1]?.time;
  return neighbor?.trim() || "12:00";
}

/**
 * LLM patch ops를 순서대로 적용. fixed 항목은 replace/remove/move 대상에서 보호.
 */
export function applyPatch(
  days: TripDaySchedule[],
  ops: PatchOp[],
  candidates: Map<string, PatchScheduleCandidate>
): TripDaySchedule[] {
  let next = days.map((d) => ({
    ...d,
    items: d.items.map((item) => ({ ...item })),
  }));

  for (const op of ops) {
    if (op.op === "move") {
      if (
        op.index == null ||
        op.toDay == null ||
        op.toIndex == null ||
        op.index < 0 ||
        op.toIndex < 0
      ) {
        continue;
      }
      const fromDay = next.find((d) => d.day === op.day);
      const item = fromDay?.items[op.index];
      if (item && isFixedItem(item)) continue;
      next = moveItem(next, { day: op.day, index: op.index }, {
        day: op.toDay,
        index: op.toIndex,
      });
      continue;
    }

    const dayIdx = next.findIndex((d) => d.day === op.day);
    if (dayIdx < 0) continue;
    const day = next[dayIdx]!;

    if (op.op === "remove") {
      if (op.index == null || op.index < 0 || op.index >= day.items.length) {
        continue;
      }
      if (isFixedItem(day.items[op.index]!)) continue;
      const items = day.items.filter((_, i) => i !== op.index);
      next[dayIdx] = recalcDay({ ...day, items });
      continue;
    }

    if (op.op === "replace") {
      if (
        op.index == null ||
        op.index < 0 ||
        op.index >= day.items.length ||
        !op.newPlaceId
      ) {
        continue;
      }
      if (isFixedItem(day.items[op.index]!)) continue;
      const cand = candidates.get(op.newPlaceId);
      if (!cand) continue;
      const time = day.items[op.index]!.time;
      const items = day.items.map((item, i) =>
        i === op.index ? candidateToItem(cand, time) : item
      );
      next[dayIdx] = recalcDay({ ...day, items });
      continue;
    }

    if (op.op === "add") {
      if (!op.newPlaceId) continue;
      const cand = candidates.get(op.newPlaceId);
      if (!cand) continue;
      const insertAt =
        op.index == null
          ? day.items.length
          : Math.max(0, Math.min(op.index, day.items.length));
      const time = defaultTimeForAdd(
        op.slot ?? undefined,
        day,
        insertAt
      );
      const items = [...day.items];
      items.splice(insertAt, 0, candidateToItem(cand, time));
      next[dayIdx] = recalcDay({ ...day, items });
    }
  }

  return next.map(recalcDay);
}
