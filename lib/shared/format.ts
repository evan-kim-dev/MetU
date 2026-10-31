/** Shared currency formatting */
export function formatKRW(value: number): string {
  return `₩${value.toLocaleString("ko-KR")}`;
}

/**
 * Plan/AI amounts are treated as KRW integers.
 * (이전 ×1500 USD 휴리스틱 제거 — 라이브 FX는 호출부에서 resolveLiveKrwRate 사용)
 */
export function normalizePriceToKrw(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value);
}
