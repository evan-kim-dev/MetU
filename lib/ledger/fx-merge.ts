import { merchantBigramSimilarity } from "@/lib/ledger/dedupe";
import { roundHalfUp } from "@/lib/ledger/money";

/**
 * K1: 외화 지출(F) + 해외 원화 청구 문자(K) 병합 — 순수 함수. I/O·LLM 없음.
 *
 * 최종 KRW = 청구액(K). 시장환율 대비 차이(%)는 "순수 수수료"가 아니라
 * (청구액 − 시장환율 환산액) / 시장환율 환산액 이다. DCC·카드사 환율·수수료가 섞여 있다.
 * 금액 반올림은 money.ts 의 roundHalfUp 만 쓴다.
 */

/** 시각이 이 안이면 같은 결제로 본다 (양쪽 시각을 모두 알 때만). */
export const FX_MERGE_TIME_WINDOW_MS = 30 * 60 * 1000;
/** 시각을 알아도 이보다 멀면 후보에서 뺀다 (dedupe.ts 의 36h 기준과 같음). */
export const FX_MERGE_TIME_LOOSE_MS = 36 * 60 * 60 * 1000;
/** 자동 병합 최소 점수 (시각 0.5 + 금액 0.4 = 0.9, 상호만 맞으면 0.5 라서 자동 불가). */
export const FX_MERGE_AUTO_MIN_SCORE = 0.8;
/** 상호 유사도가 이 이상이면 +0.1 */
export const FX_MERGE_MERCHANT_MIN_SIM = 0.5;

export const FX_MERGE_SCORE_TIME = 0.5;
export const FX_MERGE_SCORE_AMOUNT = 0.4;
export const FX_MERGE_SCORE_MERCHANT = 0.1;

// VERIFY: 청구액이 시장환율 환산액보다 -1% ~ +5% 안이면 같은 결제로 본다.
//   작성 시점 조사 기준 예시이며 카드사·DCC 여부에 따라 다르다. 운영 값은 환경변수로 덮어쓴다.
export const FX_MERGE_BAND_LOW = -0.01;
export const FX_MERGE_BAND_HIGH = 0.05;

export type FxMergeBand = { low: number; high: number };

export const DEFAULT_FX_MERGE_BAND: FxMergeBand = {
  low: FX_MERGE_BAND_LOW,
  high: FX_MERGE_BAND_HIGH,
};

/** FX_MERGE_BAND_LOW / FX_MERGE_BAND_HIGH 로 덮어쓰기. 잘못된 값이면 기본값. */
export function fxMergeBandFromEnv(
  env: Record<string, string | undefined> = process.env
): FxMergeBand {
  const low = Number(env.FX_MERGE_BAND_LOW);
  const high = Number(env.FX_MERGE_BAND_HIGH);
  const hasLow = env.FX_MERGE_BAND_LOW != null && env.FX_MERGE_BAND_LOW !== "";
  const hasHigh = env.FX_MERGE_BAND_HIGH != null && env.FX_MERGE_BAND_HIGH !== "";
  const nextLow = hasLow && Number.isFinite(low) ? low : FX_MERGE_BAND_LOW;
  const nextHigh = hasHigh && Number.isFinite(high) ? high : FX_MERGE_BAND_HIGH;
  if (!(nextLow < nextHigh) || nextLow <= -1) return DEFAULT_FX_MERGE_BAND;
  return { low: nextLow, high: nextHigh };
}

type FxMergeSide = {
  id?: string;
  tripId?: string | null;
  currency: string;
  paidAt?: string | null;
  merchant?: string | null;
};

/** 외화 지출(F). marketKrw = 시장환율로 환산한 원화(krw_base). */
export type FxMergeForeign = FxMergeSide & {
  marketKrw: number;
  /** 이미 청구액이 합쳐졌으면 후보에서 제외 */
  billedKrw?: number | null;
};

/** 해외 승인 원화 청구(K). overseas = 문자에 "해외"가 있음 (K0 플래그). */
export type FxMergeBilled = FxMergeSide & {
  krwAmount: number;
  overseas: boolean;
};

export type FxMergeCandidate = {
  /** 상대편 지출 id (K 초안이면 F 의 id, F 초안이면 K 의 id) */
  id: string;
  score: number;
  reasons: string[];
  /** 양쪽 시각을 모두 알았음 */
  timeKnown: boolean;
  /** 양쪽 시각을 알고 ±30분 안 */
  withinWindow: boolean;
  /** (청구액 − 시장 환산액) / 시장 환산액. 예: 0.032 = +3.2% */
  diffRatio: number;
};

export type FxMergeDecision =
  | { kind: "none" }
  | { kind: "auto"; target: FxMergeCandidate }
  | {
      kind: "review";
      reason: "multiple" | "time_unknown" | "time_outside" | "low_score";
      candidates: FxMergeCandidate[];
    };

function isKrw(currency: string): boolean {
  return currency.trim().toUpperCase() === "KRW";
}

function parseMs(value: string | null | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const ms = new Date(trimmed).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** F·K 한 쌍이 병합 대상인지 거르는 관문. 통과하면 true. */
export function passesFxMergeGate(
  f: FxMergeForeign,
  k: FxMergeBilled
): boolean {
  if (isKrw(f.currency)) return false; // 같은 통화 병합은 기존 dedupe 경로
  if (!isKrw(k.currency)) return false;
  if (k.overseas !== true) return false;
  if (f.billedKrw != null) return false;
  if (!f.tripId || !k.tripId || f.tripId !== k.tripId) return false;
  if (!(f.marketKrw > 0) || !(k.krwAmount > 0)) return false;
  return true;
}

/** 청구액이 시장 환산액 대비 [low, high] 안인가 (경계는 부동소수 오차 허용). */
export function isBilledInBand(
  billedKrw: number,
  marketKrw: number,
  band: FxMergeBand = DEFAULT_FX_MERGE_BAND
): boolean {
  if (!(billedKrw > 0) || !(marketKrw > 0)) return false;
  const ratio = (billedKrw - marketKrw) / marketKrw;
  const eps = 1e-9;
  return ratio >= band.low - eps && ratio <= band.high + eps;
}

/** F·K 한 쌍 점수. 관문을 못 넘거나 금액대(band)가 안 맞으면 null. */
export function scoreFxMerge(
  f: FxMergeForeign,
  k: FxMergeBilled,
  band: FxMergeBand = DEFAULT_FX_MERGE_BAND
): Omit<FxMergeCandidate, "id"> | null {
  if (!passesFxMergeGate(f, k)) return null;
  if (!isBilledInBand(k.krwAmount, f.marketKrw, band)) return null;

  const fMs = parseMs(f.paidAt);
  const kMs = parseMs(k.paidAt);
  const timeKnown = fMs != null && kMs != null;
  const gap = timeKnown ? Math.abs(fMs - kMs) : null;
  if (gap != null && gap > FX_MERGE_TIME_LOOSE_MS) return null;
  const withinWindow = gap != null && gap <= FX_MERGE_TIME_WINDOW_MS;

  const reasons: string[] = ["amount_in_band"];
  let score = FX_MERGE_SCORE_AMOUNT;
  if (withinWindow) {
    score += FX_MERGE_SCORE_TIME;
    reasons.push("within_30min");
  } else if (!timeKnown) {
    reasons.push("time_unknown");
  } else {
    reasons.push("time_outside_30min");
  }
  const sim = merchantBigramSimilarity(f.merchant ?? "", k.merchant ?? "");
  if ((f.merchant ?? "").trim() && (k.merchant ?? "").trim() && sim >= FX_MERGE_MERCHANT_MIN_SIM) {
    score += FX_MERGE_SCORE_MERCHANT;
    reasons.push("merchant_similar");
  }

  return {
    score: Math.round(score * 1000) / 1000,
    reasons,
    timeKnown,
    withinWindow,
    diffRatio: (k.krwAmount - f.marketKrw) / f.marketKrw,
  };
}

function sortCandidates(list: FxMergeCandidate[]): FxMergeCandidate[] {
  return [...list].sort((a, b) => b.score - a.score).slice(0, 3);
}

/** 새 해외 원화 청구(K 초안)에 맞는 기존 외화 지출(F) 후보. */
export function findForeignForBilled(
  k: FxMergeBilled,
  foreigners: Array<FxMergeForeign & { id: string }>,
  band: FxMergeBand = DEFAULT_FX_MERGE_BAND
): FxMergeCandidate[] {
  const out: FxMergeCandidate[] = [];
  for (const f of foreigners) {
    const s = scoreFxMerge(f, k, band);
    if (s) out.push({ id: f.id, ...s });
  }
  return sortCandidates(out);
}

/** 새 외화 지출(F 초안)에 맞는 기존 해외 원화 청구(K 지출) 후보. */
export function findBilledForForeign(
  f: FxMergeForeign,
  billeds: Array<FxMergeBilled & { id: string }>,
  band: FxMergeBand = DEFAULT_FX_MERGE_BAND
): FxMergeCandidate[] {
  const out: FxMergeCandidate[] = [];
  for (const k of billeds) {
    const s = scoreFxMerge(f, k, band);
    if (s) out.push({ id: k.id, ...s });
  }
  return sortCandidates(out);
}

/**
 * 자동 병합은 후보가 딱 1건 + 양쪽 시각을 알고 ±30분 + 점수 ≥ 0.8 일 때만.
 * 후보 0건은 "none" (병합하지 않고 기존 흐름대로 저장). 여러 건·시각 모름은 사람이 확인(review).
 */
export function decideFxMerge(candidates: FxMergeCandidate[]): FxMergeDecision {
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length > 1) {
    return { kind: "review", reason: "multiple", candidates };
  }
  const only = candidates[0]!;
  if (!only.timeKnown) {
    return { kind: "review", reason: "time_unknown", candidates };
  }
  if (!only.withinWindow) {
    return { kind: "review", reason: "time_outside", candidates };
  }
  if (only.score < FX_MERGE_AUTO_MIN_SCORE) {
    return { kind: "review", reason: "low_score", candidates };
  }
  return { kind: "auto", target: only };
}

/** 실효 환율 = 청구액 / 외화 금액 (원 per 1 외화). 입력이 잘못되면 null. */
export function effectiveRate(
  billedKrw: number,
  foreignAmount: number
): number | null {
  if (!(billedKrw > 0) || !(foreignAmount > 0)) return null;
  return roundHalfUp((billedKrw / foreignAmount) * 10000) / 10000;
}

/** 시장환율 대비 차이(%) 소수 첫째 자리. 예: 3.2 → +3.2%. 입력이 잘못되면 null. */
export function marketDiffPct(
  billedKrw: number,
  marketKrw: number
): number | null {
  if (!(billedKrw > 0) || !(marketKrw > 0)) return null;
  return roundHalfUp(((billedKrw - marketKrw) / marketKrw) * 1000) / 10;
}

/** "+3.2%" / "-0.4%" / "0.0%" */
export function formatDiffPct(pct: number): string {
  const rounded = roundHalfUp(pct * 10) / 10;
  const abs = Math.abs(rounded).toFixed(1);
  if (rounded > 0) return `+${abs}%`;
  if (rounded < 0) return `-${abs}%`;
  return "0.0%";
}

/** "예: 청구 ₩N" 처럼 쓰는 화면 문구 한 줄. 라벨은 수수료가 아니라 시장환율 대비 차이다. */
export const FX_MERGE_DIFF_LABEL = "시장환율 대비";
