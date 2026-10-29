import { haversineKm } from "@/lib/route/distance";
import type { TravelMode } from "@/lib/route/matrix/types";

/** 우회 계수 — 직선거리 대비 실제 도로 거리 가정 */
export const DETOUR_FACTOR = 1.3;

/** km/h — 모두 가정값이며 실제 도시/교통 상황과 다를 수 있음 */
export const SPEED_WALK_KMH = 4.5;
export const SPEED_DRIVE_KMH = 25;
export const SPEED_TRANSIT_KMH = 20;

/** TRANSIT: 이 거리(m) 이하면 도보와 동일하게 추정 */
export const TRANSIT_WALK_THRESHOLD_M = 1500;

/** TRANSIT: 대중교통 대기·환승 가정 (초) */
export const TRANSIT_WAIT_SEC = 5 * 60;

export function straightDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return haversineKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }) * 1000;
}

/**
 * 직선거리 기반 이동 시간·거리 추정.
 * WALK/DRIVE/TRANSIT 규칙은 Step 3-A 스펙의 가정값이다.
 */
export function estimateLeg(
  mode: TravelMode,
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { durationSec: number; distanceM: number } {
  const straightM = straightDistanceM(lat1, lng1, lat2, lng2);
  if (straightM <= 0) {
    return { durationSec: 0, distanceM: 0 };
  }

  if (mode === "WALK") {
    const distanceM = straightM * DETOUR_FACTOR;
    const durationSec = (distanceM / 1000 / SPEED_WALK_KMH) * 3600;
    return { durationSec: Math.round(durationSec), distanceM: Math.round(distanceM) };
  }

  if (mode === "DRIVE") {
    const distanceM = straightM * DETOUR_FACTOR;
    const durationSec = (distanceM / 1000 / SPEED_DRIVE_KMH) * 3600;
    return { durationSec: Math.round(durationSec), distanceM: Math.round(distanceM) };
  }

  // TRANSIT
  if (straightM <= TRANSIT_WALK_THRESHOLD_M) {
    return estimateLeg("WALK", lat1, lng1, lat2, lng2);
  }
  const distanceM = straightM * DETOUR_FACTOR;
  const durationSec =
    (distanceM / 1000 / SPEED_TRANSIT_KMH) * 3600 + TRANSIT_WAIT_SEC;
  return { durationSec: Math.round(durationSec), distanceM: Math.round(distanceM) };
}

export function buildHaversineMatrix(
  mode: TravelMode,
  lats: number[],
  lngs: number[]
): { durationsSec: number[][]; distancesM: number[][]; estimatedCells: Array<[number, number]> } {
  const n = lats.length;
  const durationsSec = Array.from({ length: n }, () => Array(n).fill(0));
  const distancesM = Array.from({ length: n }, () => Array(n).fill(0));
  const estimatedCells: Array<[number, number]> = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const leg = estimateLeg(mode, lats[i]!, lngs[i]!, lats[j]!, lngs[j]!);
      durationsSec[i]![j] = leg.durationSec;
      distancesM[i]![j] = leg.distanceM;
      estimatedCells.push([i, j]);
    }
  }

  return { durationsSec, distancesM, estimatedCells };
}
