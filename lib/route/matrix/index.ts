import "server-only";

import { getCachedMatrix, matrixCacheKey, setCachedMatrix } from "@/lib/route/matrix/cache";
import { fetchGoogleTravelMatrix } from "@/lib/route/matrix/google";
import { buildHaversineMatrix } from "@/lib/route/matrix/haversine";
import { refineKakaoLegs } from "@/lib/route/matrix/kakao";
import { fetchOsrmTravelMatrix } from "@/lib/route/matrix/osrm";
import type {
  MatrixPoint,
  TravelMatrix,
  TravelMode,
} from "@/lib/route/matrix/types";

function providerOverride():
  | "auto"
  | "google"
  | "kakao"
  | "osrm"
  | "haversine" {
  const raw = process.env.ROUTE_MATRIX_PROVIDER?.trim().toLowerCase();
  if (
    raw === "google" ||
    raw === "kakao" ||
    raw === "osrm" ||
    raw === "haversine"
  ) {
    return raw;
  }
  return "auto";
}

function haversineMatrix(
  points: MatrixPoint[],
  mode: TravelMode,
  region: "KR" | "GLOBAL"
): TravelMatrix {
  const built = buildHaversineMatrix(
    mode,
    points.map((p) => p.lat),
    points.map((p) => p.lng)
  );
  return {
    mode,
    durationsSec: built.durationsSec,
    distancesM: built.distancesM,
    source: "haversine",
    region,
    estimatedCells: built.estimatedCells,
  };
}

export async function getTravelMatrix(
  points: MatrixPoint[],
  mode: TravelMode,
  opts?: {
    region?: "KR" | "GLOBAL";
    departureTimeIso?: string;
    signal?: AbortSignal;
  }
): Promise<TravelMatrix> {
  const region = opts?.region ?? "GLOBAL";
  if (points.length < 2) {
    return haversineMatrix(points, mode, region);
  }

  const timeBucket = opts?.departureTimeIso
    ? opts.departureTimeIso.slice(0, 13)
    : undefined;
  const cacheKey = matrixCacheKey(points, mode, region, timeBucket);
  const cached = getCachedMatrix(cacheKey);
  if (cached) return cached;

  const override = providerOverride();
  let matrix: TravelMatrix | null = null;

  const tryGoogle = async () => {
    const m = await fetchGoogleTravelMatrix(
      points,
      mode,
      region,
      opts?.signal
    );
    return m;
  };
  const tryOsrm = async () =>
    fetchOsrmTravelMatrix(points, mode, region, opts?.signal);

  if (override === "haversine") {
    matrix = haversineMatrix(points, mode, region);
  } else if (override === "google") {
    matrix = (await tryGoogle()) ?? (await tryOsrm()) ?? haversineMatrix(points, mode, region);
  } else if (override === "kakao") {
    // Kakao 전 쌍 행렬 없음 → 추정으로 풀이
    matrix = haversineMatrix(points, mode, region);
  } else if (override === "osrm") {
    matrix = (await tryOsrm()) ?? haversineMatrix(points, mode, region);
  } else if (region === "KR") {
    // auto KR: 추정 행렬 (정밀화는 refineLegsForOrder)
    if (process.env.KAKAO_REST_API_KEY?.trim()) {
      matrix = haversineMatrix(points, mode, region);
    } else {
      matrix =
        (await tryGoogle()) ??
        (await tryOsrm()) ??
        haversineMatrix(points, mode, region);
    }
  } else {
    // GLOBAL
    matrix =
      (await tryGoogle()) ??
      (await tryOsrm()) ??
      haversineMatrix(points, mode, region);
  }

  setCachedMatrix(cacheKey, matrix);
  return matrix;
}

export async function refineLegsForOrder(
  matrix: TravelMatrix,
  points: MatrixPoint[],
  order: number[],
  opts?: { signal?: AbortSignal }
): Promise<TravelMatrix> {
  if (matrix.region !== "KR" || !process.env.KAKAO_REST_API_KEY?.trim()) {
    return matrix;
  }
  if (order.length < 2) return matrix;

  const refined = await refineKakaoLegs(
    points,
    order,
    matrix.mode,
    matrix.durationsSec,
    matrix.distancesM,
    matrix.estimatedCells,
    opts?.signal
  );

  if (!refined.anyRefined) return matrix;

  return {
    ...matrix,
    durationsSec: refined.durationsSec,
    distancesM: refined.distancesM,
    estimatedCells: refined.estimatedCells,
    source: "kakao",
  };
}
