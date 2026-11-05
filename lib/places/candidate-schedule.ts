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

/** 직전 방문 장소(anchor)에서 가장 가까운 같은 종류의 장소를 우선 선별 (Nearest-Neighbor) */
function pickNearestByKind(
  pool: Place[],
  used: Set<string>,
  kinds: PlaceKind[],
  anchor?: { lat: number; lng: number }
): Place | null {
  const available = pool.filter(
    (p) =>
      kinds.includes(p.kind) && !used.has(`${p.provider}:${p.providerPlaceId}`)
  );

  if (!available.length) {
    const fallback = pool.find(
      (p) => !used.has(`${p.provider}:${p.providerPlaceId}`)
    );
    return fallback ?? null;
  }

  // 기준 좌표가 없으면 첫 번째 후보 반환
  if (!anchor) return available[0]!;

  // 기준 좌표에서 하버사인 거리가 가장 짧은 장소 탐색
  let best = available[0]!;
  let bestDist = Infinity;
  for (const place of available) {
    const dist = haversineKm(anchor, place);
    if (dist < bestDist) {
      bestDist = dist;
      best = place;
    }
  }
  return best;
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
      const dinner = pickNearestByKind(pool, used, ["food", "cafe"]);
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
      const morning = pickNearestByKind(pool, used, [
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
      // 1. 오전: 클러스터 내 대표 명소/카페 선별
      const morningPick = pickNearestByKind(pool, used, [
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

      // 2. 점심: 오전 명소에서 가장 가까운 식당 선별
      const lunch = pickNearestByKind(
        pool,
        used,
        ["food", "cafe"],
        morningPick
          ? { lat: morningPick.lat, lng: morningPick.lng }
          : undefined
      );
      if (lunch) {
        used.add(`${lunch.provider}:${lunch.providerPlaceId}`);
        items.push(
          toItem(lunch, SLOTS.lunch, foodCost * priceWeight(lunch.priceLevel))
        );
      }

      // 3. 오후1: 점심 식당에서 가장 가까운 명소/쇼핑 선별
      const anchorAfterLunch = lunch ?? morningPick;
      const aft1 = pickNearestByKind(
        pool,
        used,
        ["attraction", "shopping"],
        anchorAfterLunch
          ? { lat: anchorAfterLunch.lat, lng: anchorAfterLunch.lng }
          : undefined
      );
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

      // 4. 오후2: 오후1 장소에서 가장 가까운 카페/명소 선별
      const anchorAft1 = aft1 ?? anchorAfterLunch;
      const aft2 = pickNearestByKind(
        pool,
        used,
        ["cafe", "attraction", "shopping"],
        anchorAft1
          ? { lat: anchorAft1.lat, lng: anchorAft1.lng }
          : undefined
      );
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

      // 5. 저녁: 오후 장소에서 가장 가까운 저녁 식당 선별
      const anchorAft2 = aft2 ?? anchorAft1;
      const dinner = pickNearestByKind(
        pool,
        used,
        ["food"],
        anchorAft2
          ? { lat: anchorAft2.lat, lng: anchorAft2.lng }
          : undefined
      );
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
