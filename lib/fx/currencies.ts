/** Validated ISO 4217 3-letter uppercase currency code (any). */
export type FxCurrency = string;

export interface FxTarget {
  code: FxCurrency;
  /** 표시용 심볼 (1$ 의 $) */
  symbol: string;
  /** 몇 단위를 1로 볼지 (엔은 보통 100엔 단위로 보여주기도 함) */
  unit: number;
  label: string;
  /** false 면 매핑 실패 — UI에서 통화 직접 선택 */
  resolved?: boolean;
}

const CURRENCY_CODE_RE = /^[A-Z]{3}$/;

/** ISO 4217 3자리 대문자 코드인지 검증. */
export function isCurrencyCode(code: string): boolean {
  return CURRENCY_CODE_RE.test(code.trim().toUpperCase());
}

export function normalizeCurrencyCode(code: string): string | null {
  const upper = code.trim().toUpperCase();
  return CURRENCY_CODE_RE.test(upper) ? upper : null;
}

/** Intl 로 심볼·한글 라벨 계산 (상수 표 없음). */
export function currencyDisplayMeta(code: string): {
  symbol: string;
  label: string;
} {
  const normalized = normalizeCurrencyCode(code) ?? code.trim().toUpperCase();
  let symbol = normalized;
  try {
    const parts = new Intl.NumberFormat("ko", {
      style: "currency",
      currency: normalized,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    const part = parts.find((p) => p.type === "currency");
    if (part?.value) symbol = part.value;
  } catch {
    /* keep code */
  }

  let label = normalized;
  try {
    const name = new Intl.DisplayNames(["ko"], { type: "currency" }).of(
      normalized
    );
    if (name) label = name;
  } catch {
    /* keep code */
  }

  return { symbol, label };
}

/**
 * 1 외화의 원화값 × unit ≥ 100 이 되는 가장 작은 10의 거듭제곱.
 * formatFxRate 의 표시 단위와 동일 규칙.
 */
export function computeFxDisplayUnit(krwPerUnit: number): number {
  if (!(krwPerUnit > 0) || !Number.isFinite(krwPerUnit)) return 1;
  let unit = 1;
  let amount = krwPerUnit * unit;
  while (amount < 100 && unit < 1_000_000) {
    unit *= 10;
    amount = krwPerUnit * unit;
  }
  return unit;
}

export function formatFxRate(target: FxTarget, krwPerUnit: number): string {
  // 원화는 최소 세 자리(₩xxx) 이상 나오도록 표시 단위를 키운다.
  // 예: $1 = ₩1,380 / ¥100 = ₩937 / €1 = ₩1,734
  let unit = Math.max(1, target.unit);
  let amount = krwPerUnit * unit;

  while (amount < 100 && unit < 1_000_000) {
    unit *= 10;
    amount = krwPerUnit * unit;
  }

  const unitLabel = unit === 1 ? "" : unit.toLocaleString("ko-KR");
  const foreign = `${target.symbol}${unitLabel || "1"}`;
  const rounded = Math.round(amount).toLocaleString("ko-KR");
  return `${foreign} = ₩${rounded}`;
}
