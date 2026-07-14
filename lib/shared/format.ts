/** Shared currency formatting */
export function formatKRW(value: number): string {
  return `₩${value.toLocaleString("ko-KR")}`;
}

/**
 * Live quotes sometimes return USD (or other foreign) amounts as plain numbers
 * (e.g. 480). Treat values under 10,000 as foreign units and convert ≈ KRW (×1500).
 */
export function normalizePriceToKrw(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const rounded = Math.round(value);
  if (rounded < 10_000) return rounded * 1500;
  return rounded;
}

export function parseAndNormalizeKrw(raw: string): number {
  const digits = Number(String(raw).replace(/[^0-9.]/g, "")) || 0;
  return normalizePriceToKrw(digits);
}
