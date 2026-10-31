/**
 * 알림(결제 시각) → 여행 매칭. 순수 함수 — I/O 없음.
 *
 * 규칙 (위에서부터):
 *  a. exact  — Seoul 기준 시작-1일 ~ 종료+1일 창 안.
 *  b. near   — 창 밖이지만 가장 가까운 여행과 ±14일 이내 (출발 전 예약/귀국 후 늦은 승인).
 *  c. single — 활성 여행이 정확히 1개 (날짜 무관).
 *  d. none   — 위 모두 아님.
 *
 * 자동 저장은 exact 일 때만 허용한다 (lib/agent/policy.ts).
 */

import { suggestTripDates } from "@/lib/ledger/trip-dates";
import {
  isInstantInTripWindow,
  seoulDateIso,
} from "@/lib/onboarding/trip-window";

export type TripMatchRule = "exact" | "near" | "single" | "none";

/** 매칭 실패 사유 (rule === "none" 일 때만 의미 있음). */
export type TripMatchMissReason = "no_trips" | "no_dates" | "outside_window";

/** near 로 인정하는 최대 일수 (여행 시작 전 / 종료 후). */
export const NEAR_MAX_DAYS = 14;
/** 여러 여행이 near 범위일 때 1등이 2등보다 이만큼 더 가까워야 "명확"하다. */
export const NEAR_CLEAR_MARGIN_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type TripMatchCandidate = {
  id: string;
  /** YYYY-MM-DD. 해석 실패면 null. */
  startDate: string | null;
  /** YYYY-MM-DD. null 이면 startDate 와 같은 날로 본다. */
  endDate: string | null;
  /** trips.local_currency (예: "JPY") */
  localCurrency?: string | null;
  /** 최근 생성 우선 순위용 (epoch ms) */
  createdAtMs?: number | null;
  /** "completed" 이면 후보에서 제외 */
  status?: string | null;
  destination?: string | null;
};

export type TripMatchNearest = {
  tripId: string;
  /** 시작 전이면 양수(며칠 전), 종료 후면 양수(며칠 뒤). 항상 0 이상. */
  diffDays: number;
  direction: "before" | "after";
};

export type TripMatchInput = {
  receivedAtMs: number;
  nowMs: number;
  candidates: TripMatchCandidate[];
  /** 알림 통화 힌트 (예: "JPY"). 같은 날 시작하는 여행끼리의 동점 처리용. */
  hintCurrency?: string | null;
};

export type TripMatchCandidateRank = {
  tripId: string;
  rule: Exclude<TripMatchRule, "none">;
};

export type TripMatchResult = {
  tripId: string | null;
  rule: TripMatchRule;
  /** 후보 전체 (순위순). rule 이 none 이어도 비어 있을 수 있다. */
  candidates: TripMatchCandidateRank[];
  /** rule === "none" 일 때만 */
  reason?: TripMatchMissReason;
  /** 날짜가 해석되는 여행 중 알림에 가장 가까운 것 (rule 과 무관하게 계산) */
  nearest?: TripMatchNearest;
};

function hasExplicitYear(label: string): boolean {
  return /\d{4}/.test(label);
}

/**
 * 여행의 시작/종료일을 정한다. 저장된 컬럼이 있으면 그것을 쓰고, 없으면 date_range 로 추정한다.
 * 연도 없는 라벨("7월 20일")은 "오늘" 이 아니라 알림이 온 해를 기준으로 해석한다
 * (지난 날짜가 내년으로 굴러가면 지난 알림이 안 붙는다). 올해 기준이 알림보다
 * 반년 넘게 뒤면 전년도로 한 번 더 시도한다(연말·연초). 해석 실패 시 null.
 */
export function resolveTripDatesForReceivedAt(
  input: {
    startDate?: string | null;
    endDate?: string | null;
    dateRange?: string | null;
  },
  receivedAtMs: number
): { startDate: string; endDate: string } | null {
  if (input.startDate) {
    return {
      startDate: input.startDate,
      endDate: input.endDate && input.endDate.trim() ? input.endDate : input.startDate,
    };
  }
  const label = input.dateRange?.trim();
  if (!label || !Number.isFinite(receivedAtMs)) return null;
  const year = Number(seoulDateIso(new Date(receivedAtMs)).slice(0, 4));
  let suggested = suggestTripDates(label, `${year}-01-01`);
  if (
    suggested &&
    !hasExplicitYear(label) &&
    Date.parse(`${suggested.startDate}T00:00:00+09:00`) - receivedAtMs >
      183 * DAY_MS
  ) {
    suggested = suggestTripDates(label, `${year - 1}-01-01`);
  }
  return suggested
    ? { startDate: suggested.startDate, endDate: suggested.endDate }
    : null;
}

function isoToUtcNoon(iso: string): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

function seoulStartOfDayMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00+09:00`);
}

type Dated = TripMatchCandidate & { startDate: string; endDate: string };

function asDated(c: TripMatchCandidate): Dated | null {
  if (!c.startDate) return null;
  const start = isoToUtcNoon(c.startDate);
  if (start == null) return null;
  const endIso = c.endDate && c.endDate.trim() ? c.endDate : c.startDate;
  const end = isoToUtcNoon(endIso);
  if (end == null || end < start) return null;
  return { ...c, startDate: c.startDate, endDate: endIso };
}

function gapFromTrip(
  receivedIso: string,
  trip: Dated
): { diffDays: number; direction: "before" | "after" } {
  const r = isoToUtcNoon(receivedIso) ?? 0;
  const s = isoToUtcNoon(trip.startDate) ?? 0;
  const e = isoToUtcNoon(trip.endDate) ?? 0;
  if (r < s) {
    return { diffDays: Math.round((s - r) / DAY_MS), direction: "before" };
  }
  if (r > e) {
    return { diffDays: Math.round((r - e) / DAY_MS), direction: "after" };
  }
  return { diffDays: 0, direction: "before" };
}

function sameCurrency(
  hint: string | null | undefined,
  local: string | null | undefined
): boolean {
  if (!hint || !local) return false;
  return hint.trim().toUpperCase() === local.trim().toUpperCase();
}

/**
 * 여러 exact 후보 정렬: 진행 중 > 시작일이 알림에 가까운 순 > 통화 일치 > 최근 생성.
 */
function rankExact(
  matches: Dated[],
  receivedMs: number,
  todayIso: string,
  hintCurrency: string | null | undefined
): Dated[] {
  const ongoing = (t: Dated) => t.startDate <= todayIso && todayIso <= t.endDate;
  const dist = (t: Dated) => Math.abs(seoulStartOfDayMs(t.startDate) - receivedMs);
  return [...matches].sort((a, b) => {
    const oa = ongoing(a) ? 0 : 1;
    const ob = ongoing(b) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    const da = dist(a);
    const db = dist(b);
    if (da !== db) return da - db;
    const ca = sameCurrency(hintCurrency, a.localCurrency) ? 0 : 1;
    const cb = sameCurrency(hintCurrency, b.localCurrency) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
  });
}

/** event.result.suggest 로 저장/표시되는 "이 여행에 붙일까요?" 제안. */
export type TripSuggest = {
  tripId: string;
  rule: "exact" | "near" | "single" | "outside_window";
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  /** near / outside_window 일 때 알림과의 날짜 차이(일) */
  diffDays?: number;
};

/**
 * 매칭 결과에서 제안 1건을 뽑는다.
 * - 붙은 경우(exact/near/single): 그 여행
 * - 못 붙었지만 날짜가 있는 여행이 있으면: 가장 가까운 여행 (outside_window)
 * - 그 외(여행 0개, 날짜 해석 불가 다수): null
 */
export function buildTripSuggest(
  result: TripMatchResult,
  candidates: TripMatchCandidate[]
): TripSuggest | null {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const pack = (
    tripId: string,
    rule: TripSuggest["rule"],
    diffDays?: number
  ): TripSuggest => {
    const c = byId.get(tripId);
    return {
      tripId,
      rule,
      destination: c?.destination ?? null,
      startDate: c?.startDate ?? null,
      endDate: c?.endDate ?? c?.startDate ?? null,
      ...(diffDays != null ? { diffDays } : {}),
    };
  };
  if (result.tripId && result.rule !== "none") {
    const diff =
      (result.rule === "near" || result.rule === "single") &&
      result.nearest?.tripId === result.tripId
        ? result.nearest.diffDays
        : undefined;
    return pack(result.tripId, result.rule, diff);
  }
  if (result.reason === "outside_window" && result.nearest) {
    return pack(result.nearest.tripId, "outside_window", result.nearest.diffDays);
  }
  return null;
}

/**
 * agent_events.result 에 저장할 매칭 정보.
 * - 붙은 경우: { match: { rule }, suggest? }  (policy 가 match.rule 을 읽는다)
 * - 못 붙은 경우: { reason, match: { rule: "none" }, suggest? }
 */
export function tripPickToResult(pick: {
  tripId: string | null;
  rule: TripMatchRule;
  reason?: TripMatchMissReason;
  suggest?: TripSuggest;
}): Record<string, unknown> {
  const out: Record<string, unknown> = { match: { rule: pick.rule } };
  if (!pick.tripId) out.reason = pick.reason ?? "no_dates";
  if (pick.suggest) out.suggest = pick.suggest;
  return out;
}

/** event.result 에서 매칭 규칙을 읽는다. 없으면 undefined (명시 배정/수동 배정). */
export function readTripMatchRule(result: unknown): TripMatchRule | undefined {
  if (!result || typeof result !== "object") return undefined;
  const match = (result as { match?: unknown }).match;
  if (!match || typeof match !== "object") return undefined;
  const rule = (match as { rule?: unknown }).rule;
  return rule === "exact" ||
    rule === "near" ||
    rule === "single" ||
    rule === "none"
    ? rule
    : undefined;
}

export function matchTripForEvent(input: TripMatchInput): TripMatchResult {
  const { receivedAtMs, nowMs, hintCurrency } = input;

  const active = input.candidates.filter((c) => c.status !== "completed");
  if (active.length === 0) {
    return { tripId: null, rule: "none", candidates: [], reason: "no_trips" };
  }
  if (!Number.isFinite(receivedAtMs)) {
    return { tripId: null, rule: "none", candidates: [], reason: "no_dates" };
  }

  const dated: Dated[] = [];
  for (const c of active) {
    const d = asDated(c);
    if (d) dated.push(d);
  }

  const receivedIso = seoulDateIso(new Date(receivedAtMs));
  const todayIso = seoulDateIso(new Date(nowMs));

  // 가장 가까운 여행 (진단/제안용)
  let nearest: TripMatchNearest | undefined;
  for (const t of dated) {
    const gap = gapFromTrip(receivedIso, t);
    if (!nearest || gap.diffDays < nearest.diffDays) {
      nearest = { tripId: t.id, ...gap };
    }
  }

  const ranked: TripMatchCandidateRank[] = [];

  // a. exact
  const exactMatches = dated.filter((t) =>
    isInstantInTripWindow(receivedAtMs, t.startDate, t.endDate, 1)
  );
  const exactSorted = rankExact(exactMatches, receivedAtMs, todayIso, hintCurrency);
  for (const t of exactSorted) ranked.push({ tripId: t.id, rule: "exact" });
  const exactIds = new Set(exactSorted.map((t) => t.id));

  // b. near (날짜 해석 실패 여행은 제외)
  const nearList = dated
    .filter((t) => !exactIds.has(t.id))
    .map((t) => ({ trip: t, ...gapFromTrip(receivedIso, t) }))
    .filter((x) => x.diffDays <= NEAR_MAX_DAYS)
    .sort((a, b) => a.diffDays - b.diffDays);
  const nearClear =
    nearList.length === 1 ||
    (nearList.length > 1 &&
      nearList[1]!.diffDays - nearList[0]!.diffDays >= NEAR_CLEAR_MARGIN_DAYS);
  for (const x of nearList) ranked.push({ tripId: x.trip.id, rule: "near" });

  if (exactSorted.length > 0) {
    return {
      tripId: exactSorted[0]!.id,
      rule: "exact",
      candidates: ranked,
      nearest,
    };
  }

  if (nearList.length > 0 && nearClear) {
    return {
      tripId: nearList[0]!.trip.id,
      rule: "near",
      candidates: ranked,
      nearest,
    };
  }

  // c. single — 활성 여행이 정확히 1개
  if (active.length === 1) {
    const only = active[0]!;
    if (!ranked.some((r) => r.tripId === only.id)) {
      ranked.push({ tripId: only.id, rule: "single" });
    }
    return { tripId: only.id, rule: "single", candidates: ranked, nearest };
  }

  // d. none
  return {
    tripId: null,
    rule: "none",
    candidates: ranked,
    reason: dated.length === 0 ? "no_dates" : "outside_window",
    nearest,
  };
}
