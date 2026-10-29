export function minorUnits(currency: string): number {
  const code = currency.trim().toUpperCase();
  try {
    const fmt = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
    });
    const opts = fmt.resolvedOptions();
    return typeof opts.maximumFractionDigits === "number"
      ? opts.maximumFractionDigits
      : 2;
  } catch {
    // VERIFY: unknown ISO code — treat as 2 decimal like USD
    return 2;
  }
}

/** 반올림은 이 함수만 사용. half-up (0.5 -> 1). */
export function roundHalfUp(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.floor(x + 0.5 + Number.EPSILON);
}

export interface KrwBreakdown {
  krwBase: number;
  feeKrw: number;
  krwAmount: number;
}

export function computeKrw(p: {
  amount: number;
  fxRate: number;
  feeRate?: number | null;
  feeFlatKrw?: number;
}): KrwBreakdown {
  const krwBase = roundHalfUp(p.amount * p.fxRate);
  const rate = p.feeRate == null ? 0 : p.feeRate;
  const feePct = roundHalfUp(krwBase * rate);
  const feeFlat = Math.max(0, Math.trunc(p.feeFlatKrw ?? 0));
  const feeKrw = feePct + feeFlat;
  return { krwBase, feeKrw, krwAmount: krwBase + feeKrw };
}

/** 예: 10000엔을 91000원에 환전 -> 9.1 */
export function rateFromCash(foreignAmount: number, krwPaid: number): number {
  if (!(foreignAmount > 0) || !(krwPaid > 0)) return 0;
  return krwPaid / foreignAmount;
}
