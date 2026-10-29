import "server-only";

import {
  buildHaversineMatrix,
  estimateLeg,
} from "@/lib/route/matrix/haversine";
import type { MatrixPoint, TravelMatrix, TravelMode } from "@/lib/route/matrix/types";

const FETCH_TIMEOUT_MS = 8000;
const MAX_ELEMENTS_NON_TRANSIT = 625;
const MAX_ELEMENTS_TRANSIT = 100;

function parseDurationSec(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(raw.trim());
  if (!m) return null;
  return Math.round(Number(m[1]));
}

function googleTravelMode(mode: TravelMode): string {
  return mode;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  signal?: AbortSignal
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

type MatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  status?: string;
  condition?: string;
  distanceMeters?: number;
  duration?: string;
};

async function computeRouteMatrixChunk(
  points: MatrixPoint[],
  mode: TravelMode,
  originIndices: number[],
  destIndices: number[],
  apiKey: string,
  signal?: AbortSignal
): Promise<MatrixElement[]> {
  const travelMode = googleTravelMode(mode);
  const origins = originIndices.map((i) => ({
    waypoint: {
      location: {
        latLng: { latitude: points[i]!.lat, longitude: points[i]!.lng },
      },
    },
  }));
  const destinations = destIndices.map((i) => ({
    waypoint: {
      location: {
        latLng: { latitude: points[i]!.lat, longitude: points[i]!.lng },
      },
    },
  }));

  const res = await fetchWithTimeout(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "originIndex,destinationIndex,status,condition,distanceMeters,duration",
      },
      body: JSON.stringify({ origins, destinations, travelMode }),
    },
    signal
  );

  if (!res?.ok) return [];
  try {
    const data = (await res.json()) as MatrixElement[] | { elements?: MatrixElement[] };
    if (Array.isArray(data)) return data;
    return data.elements ?? [];
  } catch {
    return [];
  }
}

function chunkIndices(n: number, maxElements: number): number[][] {
  const chunkSize = Math.max(1, Math.floor(Math.sqrt(maxElements)));
  const chunks: number[][] = [];
  for (let i = 0; i < n; i += chunkSize) {
    const part: number[] = [];
    for (let j = i; j < Math.min(n, i + chunkSize); j++) part.push(j);
    chunks.push(part);
  }
  return chunks;
}

/**
 * Google Routes computeRouteMatrix. 실패·누락 셀은 haversine 추정으로 채운다.
 */
export async function fetchGoogleTravelMatrix(
  points: MatrixPoint[],
  mode: TravelMode,
  region: "KR" | "GLOBAL",
  signal?: AbortSignal
): Promise<TravelMatrix | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!apiKey || points.length < 2) return null;

  const n = points.length;
  const maxElements =
    mode === "TRANSIT" ? MAX_ELEMENTS_TRANSIT : MAX_ELEMENTS_NON_TRANSIT;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const fallback = buildHaversineMatrix(mode, lats, lngs);

  const durationsSec = Array.from({ length: n }, () => Array(n).fill(0));
  const distancesM = Array.from({ length: n }, () => Array(n).fill(0));
  const estimatedCells: Array<[number, number]> = [...fallback.estimatedCells];
  const filled = new Set<string>();

  const originChunks = chunkIndices(n, maxElements);
  const destChunks = chunkIndices(n, maxElements);

  for (const oChunk of originChunks) {
    for (const dChunk of destChunks) {
      if (oChunk.length * dChunk.length > maxElements) continue;
      const elements = await computeRouteMatrixChunk(
        points,
        mode,
        oChunk,
        dChunk,
        apiKey,
        signal
      );
      for (const el of elements) {
        const oi = el.originIndex;
        const di = el.destinationIndex;
        if (oi == null || di == null || oi === di) continue;
        const key = `${oi},${di}`;
        if (filled.has(key)) continue;

        const dur = parseDurationSec(el.duration);
        const ok =
          el.status !== "ROUTE_NOT_FOUND" &&
          el.condition !== "ROUTE_NOT_FOUND" &&
          el.condition !== "ROUTE_DOES_NOT_EXIST" &&
          dur != null &&
          dur > 0;

        if (ok) {
          durationsSec[oi]![di] = dur;
          distancesM[oi]![di] =
            typeof el.distanceMeters === "number"
              ? el.distanceMeters
              : fallback.distancesM[oi]![di]!;
          filled.add(key);
          const idx = estimatedCells.findIndex(([i, j]) => i === oi && j === di);
          if (idx >= 0) estimatedCells.splice(idx, 1);
        }
      }
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const key = `${i},${j}`;
      if (!filled.has(key)) {
        const leg = estimateLeg(
          mode,
          points[i]!.lat,
          points[i]!.lng,
          points[j]!.lat,
          points[j]!.lng
        );
        durationsSec[i]![j] = leg.durationSec;
        distancesM[i]![j] = leg.distanceM;
        if (!estimatedCells.some(([a, b]) => a === i && b === j)) {
          estimatedCells.push([i, j]);
        }
      }
    }
  }

  const gotAny = filled.size > 0;
  return {
    mode,
    durationsSec,
    distancesM,
    source: gotAny ? "google-routes" : "haversine",
    region,
    estimatedCells,
  };
}

export { parseDurationSec };
