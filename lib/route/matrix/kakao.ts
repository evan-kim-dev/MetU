import "server-only";

import { estimateLeg, straightDistanceM } from "@/lib/route/matrix/haversine";
import type { MatrixPoint, TravelMode } from "@/lib/route/matrix/types";

/**
 * Kakao Mobility 는 자동차 전용이고 N×N 행렬 API 가 없다.
 * 대중교통/도보는 Kakao 지도 REST(일일 ~1,000건)를 쓰므로
 * 전 쌍 호출 대신 refineLegsForOrder 로 인접 구간만 조회한다.
 */

const WALK_URL = "https://dapi.kakao.com/v2/routing/walk";
const TRANSIT_URL = "https://dapi.kakao.com/v2/routing/publictraffic";
const WAYPOINTS_URL =
  "https://apis-navi.kakaomobility.com/v1/waypoints/directions";
const LEG_TIMEOUT_MS = 6000;

let dailyCount = 0;
let dailyDate = "";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dailyBudget(): number {
  const raw = Number(process.env.KAKAO_ROUTE_DAILY_BUDGET ?? "800");
  return Number.isFinite(raw) && raw > 0 ? raw : 800;
}

/** 서버리스 인스턴스별 근사 카운터 — 합계는 카카오 쿼터 화면에서 확인 */
export function canSpendKakaoRouteQuota(cost = 1): boolean {
  const day = todayKey();
  if (day !== dailyDate) {
    dailyDate = day;
    dailyCount = 0;
  }
  return dailyCount + cost <= dailyBudget();
}

function spendQuota(cost = 1): void {
  const day = todayKey();
  if (day !== dailyDate) {
    dailyDate = day;
    dailyCount = 0;
  }
  dailyCount += cost;
}

function apiKey(): string | undefined {
  return process.env.KAKAO_REST_API_KEY?.trim() || undefined;
}

async function kakaoGet(
  url: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const key = apiKey();
  if (!key) return { ok: false, status: 0, json: null };
  if (!canSpendKakaoRouteQuota(1)) {
    console.warn("[route/kakao] daily budget reached; using estimates");
    return { ok: false, status: 429, json: null };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LEG_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: controller.signal,
    });
    spendQuota(1);
    if (res.status === 429) {
      console.warn("[route/kakao] HTTP 429 (key redacted)");
      return { ok: false, status: 429, json: null };
    }
    if (!res.ok) {
      console.warn(`[route/kakao] HTTP ${res.status} (key redacted)`);
      return { ok: false, status: res.status, json: null };
    }
    return { ok: true, status: res.status, json: await res.json() };
  } catch (error) {
    console.warn(
      "[route/kakao] request failed:",
      error instanceof Error ? error.message : "unknown"
    );
    return { ok: false, status: 0, json: null };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function parseWalkResponse(
  json: unknown
): { durationSec: number; distanceM: number } | null {
  const root = json as {
    status?: string;
    route?: { properties?: { totalTime?: number; totalDistance?: number } };
  };
  if (root?.status && root.status !== "OK") return null;
  const props = root?.route?.properties;
  if (typeof props?.totalTime !== "number") return null;
  return {
    durationSec: Math.round(props.totalTime),
    distanceM: Math.round(props.totalDistance ?? 0),
  };
}

export function parseTransitResponse(
  json: unknown
): { durationSec: number; distanceM: number } | null {
  const root = json as {
    status?: string;
    routes?: Array<{
      properties?: { totalTime?: number; totalDistance?: number };
    }>;
  };
  if (root?.status && root.status !== "OK") return null;
  const routes = root?.routes ?? [];
  let best: { durationSec: number; distanceM: number } | null = null;
  for (const r of routes) {
    const t = r.properties?.totalTime;
    if (typeof t !== "number") continue;
    const cand = {
      durationSec: Math.round(t),
      distanceM: Math.round(r.properties?.totalDistance ?? 0),
    };
    if (!best || cand.durationSec < best.durationSec) best = cand;
  }
  return best;
}

export function parseWaypointsSections(
  json: unknown
): Array<{ durationSec: number; distanceM: number }> | null {
  const root = json as {
    routes?: Array<{
      result_code?: number;
      sections?: Array<{ duration?: number; distance?: number }>;
    }>;
  };
  const route = root?.routes?.[0];
  if (!route || (route.result_code != null && route.result_code !== 0)) {
    return null;
  }
  const sections = route.sections ?? [];
  if (!sections.length) return null;
  return sections.map((s) => ({
    durationSec: Math.round(s.duration ?? 0),
    distanceM: Math.round(s.distance ?? 0),
  }));
}

async function runPool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]!();
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export async function refineKakaoLegs(
  points: MatrixPoint[],
  order: number[],
  mode: TravelMode,
  durationsSec: number[][],
  distancesM: number[][],
  estimatedCells: Array<[number, number]>,
  signal?: AbortSignal
): Promise<{
  durationsSec: number[][];
  distancesM: number[][];
  estimatedCells: Array<[number, number]>;
  anyRefined: boolean;
  abortedQuota: boolean;
}> {
  if (!apiKey() || order.length < 2) {
    return {
      durationsSec,
      distancesM,
      estimatedCells,
      anyRefined: false,
      abortedQuota: false,
    };
  }

  const nextDur = durationsSec.map((row) => [...row]);
  const nextDist = distancesM.map((row) => [...row]);
  const estimated = new Set(estimatedCells.map(([i, j]) => `${i},${j}`));
  let anyRefined = false;
  let abortedQuota = false;

  const clearEstimated = (i: number, j: number) => {
    estimated.delete(`${i},${j}`);
  };

  if (mode === "DRIVE") {
    // waypoints/directions 한 번 (중간 점 청크)
    const ordered = order.map((i) => points[i]!);
    const chunks: MatrixPoint[][] = [];
    for (let start = 0; start < ordered.length - 1; ) {
      const end = Math.min(start + 31, ordered.length - 1);
      chunks.push(ordered.slice(start, end + 1));
      start = end;
    }

    for (const chunk of chunks) {
      if (chunk.length < 2) continue;
      if (!canSpendKakaoRouteQuota(1)) {
        abortedQuota = true;
        break;
      }
      const origin = chunk[0]!;
      const destination = chunk[chunk.length - 1]!;
      const waypoints = chunk.slice(1, -1).map((p) => ({
        x: p.lng,
        y: p.lat,
      }));
      const key = apiKey()!;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LEG_TIMEOUT_MS);
      try {
        const res = await fetch(WAYPOINTS_URL, {
          method: "POST",
          headers: {
            Authorization: `KakaoAK ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            origin: { x: origin.lng, y: origin.lat },
            destination: { x: destination.lng, y: destination.lat },
            waypoints,
            priority: "TIME",
          }),
          signal: signal ?? controller.signal,
        });
        spendQuota(1);
        if (res.status === 429) {
          abortedQuota = true;
          break;
        }
        if (!res.ok) continue;
        const sections = parseWaypointsSections(await res.json());
        if (!sections || sections.length !== chunk.length - 1) continue;
        for (let s = 0; s < sections.length; s++) {
          const fromId = chunk[s]!.id;
          const toId = chunk[s + 1]!.id;
          const i = points.findIndex((p) => p.id === fromId);
          const j = points.findIndex((p) => p.id === toId);
          if (i < 0 || j < 0) continue;
          nextDur[i]![j] = sections[s]!.durationSec;
          nextDist[i]![j] = sections[s]!.distanceM;
          clearEstimated(i, j);
          anyRefined = true;
        }
      } catch {
        /* keep estimates */
      } finally {
        clearTimeout(timer);
      }
    }

    return {
      durationsSec: nextDur,
      distancesM: nextDist,
      estimatedCells: [...estimated].map((k) => {
        const [i, j] = k.split(",").map(Number);
        return [i!, j!] as [number, number];
      }),
      anyRefined,
      abortedQuota,
    };
  }

  // WALK / TRANSIT: 인접 구간별 호출
  const tasks: Array<() => Promise<void>> = [];
  for (let k = 0; k < order.length - 1; k++) {
    const i = order[k]!;
    const j = order[k + 1]!;
    const a = points[i]!;
    const b = points[j]!;
    tasks.push(async () => {
      if (abortedQuota || !canSpendKakaoRouteQuota(1)) {
        abortedQuota = true;
        return;
      }
      const useWalk =
        mode === "WALK" ||
        straightDistanceM(a.lat, a.lng, b.lat, b.lng) <= 800;
      const qs = new URLSearchParams({
        start_x: String(a.lng),
        start_y: String(a.lat),
        end_x: String(b.lng),
        end_y: String(b.lat),
      });
      const url = `${useWalk ? WALK_URL : TRANSIT_URL}?${qs}`;
      const res = await kakaoGet(url, signal);
      if (res.status === 429) {
        abortedQuota = true;
        return;
      }
      if (!res.ok) return;
      const parsed = useWalk
        ? parseWalkResponse(res.json)
        : parseTransitResponse(res.json);
      if (!parsed) return;
      nextDur[i]![j] = parsed.durationSec;
      nextDist[i]![j] = parsed.distanceM;
      clearEstimated(i, j);
      anyRefined = true;
    });
  }

  await runPool(tasks, 3);

  return {
    durationsSec: nextDur,
    distancesM: nextDist,
    estimatedCells: [...estimated].map((k) => {
      const [i, j] = k.split(",").map(Number);
      return [i!, j!] as [number, number];
    }),
    anyRefined,
    abortedQuota,
  };
}

export function haversineFillCell(
  mode: TravelMode,
  a: MatrixPoint,
  b: MatrixPoint
) {
  return estimateLeg(mode, a.lat, a.lng, b.lat, b.lng);
}
