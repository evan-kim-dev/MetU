export type DedupeInput = {
  currency: string;
  amount: number;
  merchant: string;
  spentOn: string;
};

export type DedupeDraft = DedupeInput & {
  id?: string;
  paidAt?: string | null;
  krwAmount?: number;
  fxRateToKrw?: number;
  kind?: "approval" | "cancel" | "unknown";
  /** "receipt" 이면 영수증↔카드알림 강한 병합 규칙이 적용된다. */
  source?: string | null;
  /** 시각을 추정했으면(영수증에 시간 없음) 시각 비교에서 제외한다. */
  timeIsEstimated?: boolean;
};

export type DedupeExisting = DedupeInput & {
  id: string;
  krwAmount: number;
  paidAt?: string | null;
  /** trip_expenses.source (receipt|sms|manual|voice) */
  source?: string | null;
};

/** 영수증 강한 후보 reason (정책·병합 로직이 이 값으로 strong 을 판별한다). */
export const RECEIPT_STRONG_REASON = "receipt_amount_time_match";
/** strong 후보 최소 점수 */
export const RECEIPT_STRONG_MIN_SCORE = 0.8;
/** 영수증 시각과 결제 시각이 이 안이면 같은 결제로 본다. */
export const RECEIPT_TIME_WINDOW_MS = 30 * 60 * 1000;

export type DuplicateCandidate = {
  expenseId: string;
  score: number;
  reasons: string[];
};

function normalizeMerchant(merchant: string): string {
  return merchant.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  return amount.toFixed(4).replace(/\.?0+$/, "");
}

/** Browser-safe FNV-1a 64-bit hex (stable exact-match key). */
function fnv1aHex(payload: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < payload.length; i++) {
    h ^= BigInt(payload.charCodeAt(i));
    h = BigInt.asUintN(64, h * prime);
  }
  return h.toString(16).padStart(16, "0");
}

/** Stable hash for exact-match dedupe (trip_expenses.dedupe_hash). */
export function dedupeHash(input: DedupeInput): string {
  const payload = [
    input.currency.trim().toUpperCase(),
    normalizeAmount(input.amount),
    normalizeMerchant(input.merchant),
    input.spentOn.trim(),
  ].join("|");
  return fnv1aHex(payload);
}

function bigrams(text: string): Set<string> {
  const s = normalizeMerchant(text).replace(/[^a-z0-9가-힣]+/gi, "");
  const set = new Set<string>();
  if (s.length < 2) {
    if (s.length === 1) set.add(s);
    return set;
  }
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s.slice(i, i + 2));
  }
  return set;
}

export function merchantBigramSimilarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter++;
  }
  return (2 * inter) / (A.size + B.size);
}

function draftKrw(draft: DedupeDraft): number | null {
  if (typeof draft.krwAmount === "number" && Number.isFinite(draft.krwAmount)) {
    return draft.krwAmount;
  }
  const fx = draft.fxRateToKrw;
  if (typeof fx === "number" && Number.isFinite(fx) && fx > 0) {
    return draft.amount * fx;
  }
  return null;
}

function krwWithinPct(a: number, b: number, pct: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return false;
  }
  const diff = Math.abs(a - b);
  const base = Math.max(a, b);
  return diff / base <= pct;
}

function sameAmountCurrency(
  a: DedupeInput,
  b: DedupeInput
): boolean {
  return (
    a.currency.trim().toUpperCase() === b.currency.trim().toUpperCase() &&
    normalizeAmount(a.amount) === normalizeAmount(b.amount)
  );
}

function timeScore(
  draft: DedupeDraft,
  existing: DedupeExisting
): { score: number; reason?: string } {
  const dPaid = draft.paidAt?.trim();
  const ePaid = existing.paidAt?.trim();
  if (dPaid && ePaid) {
    const hours =
      Math.abs(new Date(dPaid).getTime() - new Date(ePaid).getTime()) /
      (3600 * 1000);
    if (hours <= 36) {
      return { score: 1, reason: "within_36h" };
    }
    return { score: 0 };
  }

  if (draft.spentOn.trim() === existing.spentOn.trim()) {
    return { score: 1, reason: "same_spent_on" };
  }
  return { score: 0 };
}

function amountScore(
  draft: DedupeDraft,
  existing: DedupeExisting
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (sameAmountCurrency(draft, existing)) {
    reasons.push("same_amount_currency");
    return { score: 1, reasons };
  }
  const dk = draftKrw(draft);
  if (dk != null && krwWithinPct(dk, existing.krwAmount, 0.03)) {
    reasons.push("krw_within_3pct");
    return { score: 0.85, reasons };
  }
  return { score: 0, reasons };
}

function scorePair(
  draft: DedupeDraft,
  existing: DedupeExisting
): DuplicateCandidate | null {
  if (draft.id && draft.id === existing.id) return null;

  const merchantSim = merchantBigramSimilarity(
    draft.merchant,
    existing.merchant
  );
  const { score: timeS, reason: timeReason } = timeScore(draft, existing);
  const { score: amountS, reasons: amountReasons } = amountScore(
    draft,
    existing
  );

  if (timeS <= 0 || amountS <= 0) return null;

  const score = merchantSim * 0.45 + amountS * 0.35 + timeS * 0.2;
  if (score < 0.6) return null;

  const reasons: string[] = [];
  if (merchantSim >= 0.5) reasons.push("merchant_similar");
  reasons.push(...amountReasons);
  if (timeReason) reasons.push(timeReason);

  return {
    expenseId: existing.id,
    score: Math.round(score * 1000) / 1000,
    reasons,
  };
}

/**
 * 영수증 ↔ 카드알림: 같은 통화·금액이고 시각이 가까우면(±30분, 시각을 모르면 같은 날)
 * 상호가 달라도(ローソン vs LAWSON ENT) 강한 후보로 본다.
 * 시간창을 좁게 유지해 같은 날 두 번째 커피 오탐을 막는다. 상호가 비슷하면 가산.
 */
function receiptStrongPair(
  draft: DedupeDraft,
  existing: DedupeExisting
): DuplicateCandidate | null {
  if (draft.id && draft.id === existing.id) return null;
  if (draft.source !== "receipt" && existing.source !== "receipt") return null;
  if (!sameAmountCurrency(draft, existing)) return null;

  const dPaid = draft.timeIsEstimated ? "" : (draft.paidAt?.trim() ?? "");
  const ePaid = existing.paidAt?.trim() ?? "";

  const reasons: string[] = [RECEIPT_STRONG_REASON, "same_amount_currency"];
  let base = RECEIPT_STRONG_MIN_SCORE;

  if (dPaid && ePaid) {
    const diff = Math.abs(new Date(dPaid).getTime() - new Date(ePaid).getTime());
    if (!Number.isFinite(diff) || diff > RECEIPT_TIME_WINDOW_MS) return null;
    reasons.push("within_30min");
    base += 0.05;
  } else if (draft.spentOn.trim() && draft.spentOn.trim() === existing.spentOn.trim()) {
    reasons.push("same_spent_on", "time_unknown");
  } else {
    return null;
  }

  const merchantSim = merchantBigramSimilarity(draft.merchant, existing.merchant);
  if (merchantSim >= 0.5) reasons.push("merchant_similar");
  const score = Math.min(1, base + 0.15 * merchantSim);

  return {
    expenseId: existing.id,
    score: Math.round(score * 1000) / 1000,
    reasons,
  };
}

/** 후보가 영수증 strong 규칙으로 잡힌 것인지 */
export function isReceiptStrongCandidate(c: DuplicateCandidate): boolean {
  return (
    c.reasons.includes(RECEIPT_STRONG_REASON) &&
    c.score >= RECEIPT_STRONG_MIN_SCORE
  );
}

function cancelCandidates(
  draft: DedupeDraft,
  existing: DedupeExisting[]
): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  for (const row of existing) {
    if (draft.id && draft.id === row.id) continue;
    if (!sameAmountCurrency(draft, row)) continue;
    const sim = merchantBigramSimilarity(draft.merchant, row.merchant);
    if (sim < 0.4) continue;
    out.push({
      expenseId: row.id,
      score: Math.round(sim * 1000) / 1000,
      reasons: ["cancel_match", "same_amount_currency", "merchant_similar"],
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

/**
 * Fuzzy duplicate detection for SMS/manual drafts (max 3, score ≥ 0.6).
 */
export function findDuplicateCandidates(
  draft: DedupeDraft,
  existing: DedupeExisting[]
): DuplicateCandidate[] {
  if (draft.kind === "cancel") {
    return cancelCandidates(draft, existing);
  }

  const scored: DuplicateCandidate[] = [];
  for (const row of existing) {
    const strong = receiptStrongPair(draft, row);
    const soft = strong ? null : scorePair(draft, row);
    if (strong) {
      scored.push(strong);
    } else if (soft) {
      scored.push(soft);
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}
