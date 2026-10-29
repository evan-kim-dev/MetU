import type { TravelStyle } from "@/lib/onboarding/types";
import type { DaySchedule } from "@/lib/ai/types";
import type { Place, PlaceKind } from "@/lib/places/types";

const SLOTS = {
  morning: "09:30",
  lunch: "12:00",
  afternoon1: "14:00",
  afternoon2: "16:30",
  dinner: "18:30",
} as const;

const DURATION: Record<PlaceKind, number> = {
  attraction: 90,
  food: 75,
  cafe: 60,
  shopping: 90,
  lodging: 30,
  transport: 30,
  other: 60,
};

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 결정적 greedy 클러스터링 (시드 고정: 위도·경도 정렬 후 균등 시드) */
function clusterPlaces(places: Place[], k: number): Place[][] {
  if (k <= 0) return [];
  if (!places.length) return Array.from({ length: k }, () => []);

  const sorted = [...places].sort((a, b) =>
    a.lat !== b.lat ? a.lat - b.lat : a.lng - b.lng
  );

  const centroids: { lat: number; lng: number }[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.min(
      sorted.length - 1,
      Math.floor((i * sorted.length) / k)
    );
    const p = sorted[idx]!;
    centroids.push({ lat: p.lat, lng: p.lng });
  }

  const clusters: Place[][] = Array.from({ length: k }, () => []);
  for (const place of sorted) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < k; i++) {
      const d = haversineKm(place, centroids[i]!);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    clusters[best]!.push(place);
  }

  // 빈 클러스터에 가장 큰 클러스터에서 이동
  for (let i = 0; i < k; i++) {
    if (clusters[i]!.length) continue;
    const donor = clusters.reduce(
      (best, cur, idx) =>
        cur.length > clusters[best]!.length ? idx : best,
      0
    );
    if (clusters[donor]!.length > 1) {
      clusters[i]!.push(clusters[donor]!.pop()!);
    }
  }

  return clusters;
}

function priceWeight(priceLevel?: string): number {
  if (!priceLevel) return 1;
  if (priceLevel.includes("INEXPENSIVE") || priceLevel.includes("FREE"))
    return 0.7;
  if (priceLevel.includes("MODERATE")) return 1;
  if (priceLevel.includes("EXPENSIVE")) return 1.3;
  if (priceLevel.includes("VERY_EXPENSIVE")) return 1.6;
  return 1;
}

function pickByKind(
  pool: Place[],
  used: Set<string>,
  kinds: PlaceKind[]
): Place | null {
  for (const kind of kinds) {
    const found = pool.find(
      (p) =>
        p.kind === kind && !used.has(`${p.provider}:${p.providerPlaceId}`)
    );
    if (found) return found;
  }
  const any = pool.find(
    (p) => !used.has(`${p.provider}:${p.providerPlaceId}`)
  );
  return any ?? null;
}

function toItem(
  place: Place,
  time: string,
  cost: number
): DaySchedule["items"][number] {
  return {
    time,
    title: place.name,
    detail: place.address ?? place.categoryName ?? undefined,
    cost: Math.max(0, Math.round(cost)),
    placeId: place.id || undefined,
    provider: place.provider,
    providerPlaceId: place.providerPlaceId,
    hoursKnown: place.openingHours != null,
    detailUrl: place.mapsUri,
    lat: place.lat,
    lng: place.lng,
    durationMin: DURATION[place.kind] ?? 60,
    kind: place.kind,
  };
}

export function buildScheduleFromCandidates(params: {
  places: Place[];
  nights: number;
  styles: TravelStyle[];
  budgets: { food: number; activity: number; transport: number };
  city: string;
  origin: string;
}): DaySchedule[] {
  const { places, nights, budgets, city, origin } = params;
  if (!places.length || nights < 0) return [];

  const dayCount = nights + 1;
  const clusters = clusterPlaces(places, dayCount);
  const used = new Set<string>();
  const mealsPerDay = 2;
  const foodCost = budgets.food / mealsPerDay;
  const activitySlots = 3;

  const days: DaySchedule[] = [];

  for (let d = 0; d < dayCount; d++) {
    const pool = clusters[d] ?? [];
    const items: DaySchedule["items"] = [];

    if (d === 0) {
      items.push({
        time: "14:00",
        title: `${city} 공항 도착 · 시내 이동`,
        detail: `${origin}에서 도착한 뒤 대중교통·택시로 ${city} 시내로 이동해요.`,
        cost: budgets.transport,
        fixed: true,
        kind: "transport",
      });
      items.push({
        time: "16:00",
        title: "숙소 체크인 & 휴식",
        detail: `${city} 시내 숙소에 짐을 내려놓고 가볍게 쉬어요.`,
        cost: 0,
        fixed: true,
        kind: "lodging",
      });
      const dinner = pickByKind(pool, used, ["food", "cafe"]);
      if (dinner) {
        used.add(`${dinner.provider}:${dinner.providerPlaceId}`);
        items.push(
          toItem(
            dinner,
            SLOTS.dinner,
            foodCost * priceWeight(dinner.priceLevel)
          )
        );
      } else {
        items.push({
          time: SLOTS.dinner,
          title: `${city} 현지 저녁`,
          detail: `${city} 숙소 근처 식당에서 첫 저녁을 먹으며 동네를 익혀요.`,
          cost: Math.round(foodCost),
          kind: "food",
          hoursKnown: false,
        });
      }
    } else if (d === dayCount - 1) {
      const morning = pickByKind(pool, used, [
        "attraction",
        "shopping",
        "cafe",
      ]);
      if (morning) {
        used.add(`${morning.provider}:${morning.providerPlaceId}`);
        items.push(
          toItem(
            morning,
            SLOTS.morning,
            (budgets.activity / activitySlots) *
              priceWeight(morning.priceLevel)
          )
        );
      }
      items.push({
        time: "12:00",
        title: "숙소 체크아웃",
        detail: `짐을 정리하고 ${city} 숙소를 나가요.`,
        cost: 0,
        fixed: true,
        kind: "lodging",
      });
      items.push({
        time: "15:00",
        title: `${city} 공항 출발 · 귀국`,
        detail: `${city}에서 ${origin}으로 출발해요.`,
        cost: budgets.transport,
        fixed: true,
        kind: "transport",
      });
    } else {
      const morningPick = pickByKind(pool, used, [
        "attraction",
        "shopping",
        "cafe",
      ]);
      if (morningPick) {
        used.add(`${morningPick.provider}:${morningPick.providerPlaceId}`);
        items.push(
          toItem(
            morningPick,
            SLOTS.morning,
            (budgets.activity / activitySlots) *
              priceWeight(morningPick.priceLevel)
          )
        );
      }

      const lunch = pickByKind(pool, used, ["food", "cafe"]);
      if (lunch) {
        used.add(`${lunch.provider}:${lunch.providerPlaceId}`);
        items.push(
          toItem(lunch, SLOTS.lunch, foodCost * priceWeight(lunch.priceLevel))
        );
      }

      const aft1 = pickByKind(pool, used, [
        "attraction",
        "shopping",
        "cafe",
      ]);
      if (aft1) {
        used.add(`${aft1.provider}:${aft1.providerPlaceId}`);
        items.push(
          toItem(
            aft1,
            SLOTS.afternoon1,
            (budgets.activity / activitySlots) * priceWeight(aft1.priceLevel)
          )
        );
      }

      const aft2 = pickByKind(pool, used, [
        "shopping",
        "attraction",
        "cafe",
      ]);
      if (aft2) {
        used.add(`${aft2.provider}:${aft2.providerPlaceId}`);
        items.push(
          toItem(
            aft2,
            SLOTS.afternoon2,
            (budgets.activity / activitySlots) * priceWeight(aft2.priceLevel)
          )
        );
      }

      const dinner = pickByKind(pool, used, ["food"]);
      if (dinner) {
        used.add(`${dinner.provider}:${dinner.providerPlaceId}`);
        items.push(
          toItem(
            dinner,
            SLOTS.dinner,
            foodCost * priceWeight(dinner.priceLevel)
          )
        );
      }
    }

    const dayTotal = items.reduce((s, it) => s + (it.cost || 0), 0);
    const label =
      d === 0
        ? `${city} 도착 · 적응`
        : d === dayCount - 1
          ? `${city} 귀국 준비`
          : `${city} ${d + 1}일차`;

    days.push({
      day: d + 1,
      label,
      items,
      dayTotal,
    });
  }

  return days;
}
