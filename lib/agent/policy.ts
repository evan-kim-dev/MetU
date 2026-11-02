import type { FxMergeCandidate, FxMergeDecision } from "@/lib/ledger/fx-merge";

export type DraftOrigin = "rule" | "llm" | "receipt" | "manual";

export type DraftKind = "approval" | "cancel" | "other" | "unknown";

export type PricedDraft = {
  origin: DraftOrigin;
  kind: DraftKind;
  confidence: number;
  currency: string;
  amount: number;
  krwAmount: number;
  /** KRW payments need no FX; foreign needs fxResolved && !fxIsFallback */
  fxResolved: boolean;
  fxIsFallback: boolean;
  payerMemberId: string | null;
  unresolvedNames: string[];
  warnings: string[];
  spentOn?: string | null;
  /** Exact re-delivery of same SMS (idempotent payload), not a second purchase */
  exactResend?: boolean;
};

export type DuplicateSignal = {
  expenseId: string;
  score: number;
  spentOn?: string | null;
  /** 영수증 amount+time 강한 일치 (lib/ledger/dedupe.ts isReceiptStrongCandidate) */
  strong?: boolean;
  /** 기존 지출에 이미 영수증(receipt_path)이 붙어 있음 */
  receiptAttached?: boolean;
  /** 시각을 서로 비교할 수 있었음(±30분 안) */
  timeKnown?: boolean;
  /** 상호 유사도가 높음 */
  merchantSimilar?: boolean;
};

export type PolicySignals = {
  duplicateCandidates: DuplicateSignal[];
  autoCountToday: number;
  /**
   * 여행이 어떤 규칙으로 붙었는지 (lib/onboarding/trip-match.ts).
   * 생략 = 사용자/토큰이 명시한 여행. "exact" 가 아니면(near/single) 자동 저장 금지.
   */
  tripMatchRule?: "exact" | "near" | "single" | "none";
  /**
   * K1: 외화 지출 ↔ 해외 원화 청구 문자 병합 판단 (lib/ledger/fx-merge.ts 순수 결과).
   * 생략 = 병합 경로 아님(같은 통화 병합·일반 저장은 기존 규칙 그대로).
   */
  fxMerge?: FxMergeDecision;
};

export type PolicyEnv = {
  autoMaxKrw: number;
  autoDailyCap: number;
  autoReceipt: boolean;
  ownerMemberId: string;
};

export type PolicyDecision = "auto_commit" | "review" | "ignore" | "merge";

/** receipt_attach: 영수증 사진만 붙임 / billed_krw: 해외 원화 청구액을 외화 지출에 합침(K1) */
export type MergeKind = "receipt_attach" | "billed_krw";

export type PolicyResult = {
  decision: PolicyDecision;
  reasons: string[];
  /** decision=merge(또는 합치기 후보 review): 병합 종류 */
  mergeKind?: MergeKind;
  /** decision=merge: 새 지출 없이 영수증/청구액을 붙일 기존 지출 */
  mergeExpenseId?: string;
  /** mergeKind=billed_krw 인 review: 합칠 후보 (수신함 선택용) */
  fxMergeCandidates?: FxMergeCandidate[];
  /** review 이면서 같은 결제로 보이는 기존 지출 (수신함 합치기 선택용) */
  duplicateOfExpenseId?: string;
  /** review 사유 코드 (기계 판독용, 예: "trip_match_uncertain") */
  reasonCode?: string;
};

export const TRIP_MATCH_UNCERTAIN = "trip_match_uncertain";
/** 외화인데 환율을 확정하지 못했거나 폴백 환율일 때 (사유 문구: lib/agent/event-status.ts) */
export const FX_UNRESOLVED = "fx_unresolved";
/** 외화 지출과 해외 원화 청구가 같은 결제로 보이지만 자동 병합 조건은 못 채웠을 때 */
export const FX_MERGE_REVIEW = "fx_merge_review";

const FX_MERGE_REVIEW_REASONS = {
  multiple:
    "같은 해외 결제로 보이는 지출이 여러 건이에요 — 합칠 지출을 골라 주세요",
  time_unknown:
    "금액은 비슷한데 결제 시각을 몰라서 확인이 필요해요 — 같은 결제면 합쳐 주세요",
  time_outside:
    "금액은 비슷한데 결제 시각이 30분 넘게 차이 나요 — 같은 결제인지 확인해 주세요",
  low_score: "같은 해외 결제인지 확실하지 않아요 — 확인해 주세요",
} as const;

/** 날짜 규칙으로 붙었지만 exact 가 아닌 경우 */
export function isTripMatchUncertain(
  rule: PolicySignals["tripMatchRule"]
): boolean {
  return rule === "near" || rule === "single" || rule === "none";
}

function fmtWon(n: number): string {
  return `${Math.trunc(n).toLocaleString("ko-KR")}원`;
}

function isKrw(currency: string): boolean {
  return currency.trim().toUpperCase() === "KRW";
}

/**
 * Pure policy: auto_commit only when every gate passes.
 * Never mutates input. No I/O.
 */
export function decide(
  priced: PricedDraft,
  signals: PolicySignals,
  env: PolicyEnv
): PolicyResult {
  const reasons: string[] = [];

  if (priced.kind === "other") {
    return {
      decision: "ignore",
      reasons: ["결제 문자가 아니어서 건너뛰었어요"],
    };
  }

  // Cancel/refund always needs a human — before duplicate short-circuits.
  if (priced.kind === "cancel") {
    return {
      decision: "review",
      reasons: ["취소·환불 문자는 직접 확인해 주세요"],
    };
  }

  // Only ignore true re-delivery of the same SMS, not a second purchase.
  if (priced.exactResend) {
    return {
      decision: "ignore",
      reasons: ["이미 받은 같은 문자라서 건너뛰었어요"],
    };
  }

  // Trip was attached by a loose rule (near/single): never auto-save. A human
  // confirms in the inbox (existing confirm path). Stricter-only gate.
  if (isTripMatchUncertain(signals.tripMatchRule)) {
    return {
      decision: "review",
      reasons: ["여행 날짜가 정확히 맞지 않아 확인이 필요해요"],
      reasonCode: TRIP_MATCH_UNCERTAIN,
    };
  }

  // K1: 외화 지출 ↔ 해외 원화 청구. 후보 1건 + 시각 ±30분일 때만 자동 병합, 아니면 사람이 확인.
  // 후보가 없으면(none) 아래 기존 규칙 그대로 진행한다.
  const fx = signals.fxMerge;
  if (fx?.kind === "auto") {
    return {
      decision: "merge",
      mergeKind: "billed_krw",
      reasons: ["같은 해외 결제라서 원화 청구액을 합쳐요"],
      mergeExpenseId: fx.target.id,
    };
  }
  if (fx?.kind === "review") {
    const first = fx.candidates[0];
    return {
      decision: "review",
      mergeKind: "billed_krw",
      reasons: [FX_MERGE_REVIEW_REASONS[fx.reason]],
      reasonCode: FX_MERGE_REVIEW,
      fxMergeCandidates: fx.candidates,
      ...(first ? { duplicateOfExpenseId: first.id } : {}),
    };
  }

  // Receipt vs existing payment: never create a second expense for the same
  // payment. Attach to the existing one when it is unambiguous, else review.
  if (priced.origin === "receipt") {
    const strong = signals.duplicateCandidates
      .filter((d) => d.strong)
      .sort((a, b) => b.score - a.score);
    if (strong.length >= 2) {
      return {
        decision: "review",
        reasons: ["같은 결제로 보이는 지출이 여러 건이에요 — 합칠 지출을 골라 주세요"],
      };
    }
    const only = strong[0];
    if (only) {
      if (
        only.receiptAttached ||
        (!only.timeKnown && !only.merchantSimilar)
      ) {
        return {
          decision: "review",
          reasons: ["이미 같은 결제가 있어요 — 합치기/별개로 저장"],
          mergeKind: "receipt_attach",
          duplicateOfExpenseId: only.expenseId,
        };
      }
      return {
        decision: "merge",
        mergeKind: "receipt_attach",
        reasons: ["이미 같은 결제가 있어서 영수증만 붙여요"],
        mergeExpenseId: only.expenseId,
      };
    }
  }

  if (priced.origin === "llm") {
    return {
      decision: "review",
      reasons: ["AI가 읽은 내용은 확인이 필요해요"],
    };
  }

  if (priced.origin === "receipt") {
    if (
      !env.autoReceipt ||
      priced.confidence < 0.9 ||
      (priced.warnings?.length ?? 0) > 0
    ) {
      return {
        decision: "review",
        reasons: ["영수증은 기본으로 확인이 필요해요"],
      };
    }
  }

  const needsReview: string[] = [];
  let fxUnresolved = false;

  if (priced.origin !== "rule" && priced.origin !== "receipt") {
    needsReview.push("규칙으로 읽지 못한 입력이에요");
  }

  if (priced.kind !== "approval") {
    needsReview.push("승인 문자가 아니에요");
  }

  if (priced.confidence < 0.85) {
    needsReview.push(
      `신뢰도가 ${(priced.confidence * 100).toFixed(0)}%라서 확인이 필요해요`
    );
  } else {
    reasons.push(`신뢰도 ${(priced.confidence * 100).toFixed(0)}%`);
  }

  if (!priced.spentOn) {
    needsReview.push("결제 날짜를 확정하지 못했어요");
  }

  if ((priced.warnings?.length ?? 0) > 0) {
    needsReview.push(`주의: ${priced.warnings[0]}`);
  }

  if (!isKrw(priced.currency)) {
    if (!priced.fxResolved || priced.fxIsFallback) {
      fxUnresolved = true;
      needsReview.push("환율을 확실히 못 구했어요");
    } else {
      reasons.push("환율이 준비됐어요");
    }
  } else {
    reasons.push("원화 결제라 환율이 필요 없어요");
  }

  if (!priced.payerMemberId || priced.payerMemberId !== env.ownerMemberId) {
    needsReview.push("결제자를 여행 멤버로 확정하지 못했어요");
  } else {
    reasons.push("결제자가 본인으로 확정됐어요");
  }

  if (priced.unresolvedNames.length > 0) {
    needsReview.push(
      `이름을 못 맞춘 사람이 있어요: ${priced.unresolvedNames.join(", ")}`
    );
  }

  const softDup = signals.duplicateCandidates.find((d) => d.score >= 0.6);
  if (softDup) {
    // Similar spend → human check (do not silently drop second coffee)
    needsReview.push("비슷한 지출이 이미 있어요");
  } else {
    reasons.push("중복 후보 없음");
  }

  if (priced.krwAmount > env.autoMaxKrw) {
    needsReview.push(
      `금액 ${fmtWon(priced.krwAmount)}이 자동 한도 ${fmtWon(env.autoMaxKrw)}을 넘어요`
    );
  } else {
    reasons.push(`금액 ${fmtWon(priced.krwAmount)} 이하`);
  }

  if (signals.autoCountToday >= env.autoDailyCap) {
    needsReview.push("오늘 자동 저장 한도에 도달했어요");
  }

  if (needsReview.length > 0) {
    return {
      decision: "review",
      reasons: needsReview,
      ...(fxUnresolved ? { reasonCode: FX_UNRESOLVED } : {}),
    };
  }

  reasons.push("조건이 맞아 자동으로 저장해요");
  return { decision: "auto_commit", reasons };
}

export function policyEnvFromProcess(
  ownerMemberId: string,
  env: NodeJS.ProcessEnv = process.env
): PolicyEnv {
  const max = Number(env.AGENT_AUTO_MAX_KRW ?? "300000");
  const cap = Number(env.AGENT_AUTO_DAILY_CAP ?? "30");
  return {
    ownerMemberId,
    autoMaxKrw: Number.isFinite(max) && max > 0 ? max : 300_000,
    autoDailyCap: Number.isFinite(cap) && cap > 0 ? cap : 30,
    autoReceipt: env.AGENT_AUTO_RECEIPT === "1",
  };
}
