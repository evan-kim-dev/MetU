export type PaceStatus = "under" | "on_pace" | "over";

export interface PaceAssessment {
  status: PaceStatus;
  /** planned − allowance (양수면 초과) */
  deltaKRW: number;
  /** planned / allowance (allowance 0 이면 0) */
  ratio: number;
}

/**
 * 일정 일평균(또는 오늘) 계획 지출 vs 안전 한도.
 * softBand 안이면 on_pace (기본 ±10%).
 */
export function assessDailyPace(params: {
  plannedDayTotalKRW: number;
  allowanceKRW: number;
  softBand?: number;
}): PaceAssessment {
  const planned = Math.max(0, Math.floor(params.plannedDayTotalKRW));
  const allowance = Math.max(0, Math.floor(params.allowanceKRW));
  const band = params.softBand ?? 0.1;
  const deltaKRW = planned - allowance;

  if (allowance <= 0) {
    return {
      status: planned > 0 ? "over" : "on_pace",
      deltaKRW,
      ratio: 0,
    };
  }

  const ratio = planned / allowance;
  if (ratio > 1 + band) {
    return { status: "over", deltaKRW, ratio };
  }
  if (ratio < 1 - band) {
    return { status: "under", deltaKRW, ratio };
  }
  return { status: "on_pace", deltaKRW, ratio };
}

/** 일정표 dayTotal 평균 (일수 0이면 0) */
export function averageDayTotal(
  days: Array<{ dayTotal: number }>
): number {
  if (days.length === 0) return 0;
  const sum = days.reduce(
    (s, d) => s + Math.max(0, Math.floor(d.dayTotal)),
    0
  );
  return Math.floor(sum / days.length);
}
