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
};

export type DedupeExisting = DedupeInput & {
  id: string;
  krwAmount: number;
  paidAt?: string | null;
};

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
    const hit = scorePair(draft, row);
    if (hit) scored.push(hit);
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}
