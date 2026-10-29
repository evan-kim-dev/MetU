import "server-only";

import { buildHaversineMatrix } from "@/lib/route/matrix/haversine";
import type { MatrixPoint, TravelMatrix, TravelMode } from "@/lib/route/matrix/types";

const FETCH_TIMEOUT_MS = 8000;

function osrmProfile(mode: TravelMode): string {
  if (mode === "DRIVE") return "driving";
  if (mode === "WALK") return "foot";
  return "driving";
}

/**
 * 공개 OSRM table API (선택). OSRM_BASE_URL 미설정 시 null.
 */
export async function fetchOsrmTravelMatrix(
  points: MatrixPoint[],
  mode: TravelMode,
  region: "KR" | "GLOBAL",
  signal?: AbortSignal
): Promise<TravelMatrix | null> {
  const base = process.env.OSRM_BASE_URL?.trim().replace(/\/$/, "");
  if (!base || points.length < 2) return null;

  const n = points.length;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const profile = osrmProfile(mode);
  const url = `${base}/table/v1/${profile}/${coords}?annotations=duration,distance`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  let res: Response | null = null;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch {
    res = null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const fallback = buildHaversineMatrix(mode, lats, lngs);

  if (!res?.ok) return null;

  try {
    const data = (await res.json()) as {
      durations?: number[][];
      distances?: number[][];
      code?: string;
    };
    if (data.code !== "Ok" || !data.durations?.length) return null;

    const durationsSec = Array.from({ length: n }, () => Array(n).fill(0));
    const distancesM = Array.from({ length: n }, () => Array(n).fill(0));
    const estimatedCells: Array<[number, number]> = [];

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dur = data.durations[i]?.[j];
        const dist = data.distances?.[i]?.[j];
        if (typeof dur === "number" && Number.isFinite(dur) && dur >= 0) {
          durationsSec[i]![j] = Math.round(dur);
          distancesM[i]![j] =
            typeof dist === "number" && dist >= 0
              ? Math.round(dist)
              : fallback.distancesM[i]![j]!;
        } else {
          durationsSec[i]![j] = fallback.durationsSec[i]![j]!;
          distancesM[i]![j] = fallback.distancesM[i]![j]!;
          estimatedCells.push([i, j]);
        }
      }
    }

    return {
      mode,
      durationsSec,
      distancesM,
      source: estimatedCells.length ? "osrm" : "osrm",
      region,
      estimatedCells,
    };
  } catch {
    return null;
  }
}
