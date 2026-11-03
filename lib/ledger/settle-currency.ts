import { minorUnits, roundHalfUp } from "@/lib/ledger/money";
import { normalizeCurrencyCode } from "@/lib/fx/currencies";

/**
 * 정산 금액의 "참고용" 통화 환산. 표시 전용 순수 함수만 둔다.
 * - 저장/송금 기준은 항상 정수 KRW 이고 여기서 바꾸지 않는다.
 * - 환율은 호출부가 넘긴다(라이브 조회값 또는 사용자가 고정한 값). 코드에 환율 상수를 두지 않는다.
 * - 환율 단위: 외화 1단위당 원화 (예: 1 JPY = 9.12원 → 9.12).
 */

/**
 * 고정 환율이 라이브 환율의 몇 배 범위 안이어야 하는지(오타 방지용 검증 폭).
 * 시세 예측이 아니라 자릿수 실수(예: 9.12 → 912)를 막기 위한 느슨한 값이에요.
 */
const FIXED_RATE_MAX_FACTOR = 5;

export type FixedRateReason = "not-a-number" | "non-positive" | "far-from-live";

export type FixedRateResult =
  | { ok: true; rate: number }
  | { ok: false; reason: FixedRateReason };

/** 입력 문자열/숫자를 숫자로. 콤마·공백은 무시한다. 해석 못 하면 NaN. */
function parseRate(input: number | string): number {
  if (typeof input === "number") return input;
  const cleaned = input.replace(/[,\s]/g, "");
  if (cleaned === "") return Number.NaN;
  return Number(cleaned);
}

/**
 * 사용자가 고정한 환율 검증. 라이브 환율이 있으면 FIXED_RATE_MAX_FACTOR 배 범위 밖은 막는다.
 */
export function validateFixedRate(
  input: number | string,
  liveRate?: number | null
): FixedRateResult {
  const n = parseRate(input);
  if (!Number.isFinite(n)) return { ok: false, reason: "not-a-number" };
  if (!(n > 0)) return { ok: false, reason: "non-positive" };
  if (liveRate != null && Number.isFinite(liveRate) && liveRate > 0) {
    if (
      n > liveRate * FIXED_RATE_MAX_FACTOR ||
      n < liveRate / FIXED_RATE_MAX_FACTOR
    ) {
      return { ok: false, reason: "far-from-live" };
    }
  }
  return { ok: true, rate: n };
}

export function fixedRateMessage(reason: FixedRateReason): string {
  switch (reason) {
    case "not-a-number":
      return "숫자로 입력해 주세요.";
    case "non-positive":
      return "0보다 큰 환율을 입력해 주세요.";
    default:
      return "지금 환율과 너무 달라요. 자릿수를 다시 확인해 주세요.";
  }
}

type EffectiveRateSource = "fixed" | "live";

export interface EffectiveRate {
  rate: number;
  source: EffectiveRateSource;
}

/**
 * 실제로 쓸 환율. 유효한 고정 환율이 있으면 그것을, 아니면 라이브 환율을 쓴다.
 * 둘 다 없으면 null (호출부에서 "환율을 못 가져왔어요" 안내).
 */
export function effectiveRate(p: {
  liveRate?: number | null;
  fixedRate?: number | string | null;
}): EffectiveRate | null {
  const live =
    p.liveRate != null && Number.isFinite(p.liveRate) && p.liveRate > 0
      ? p.liveRate
      : null;
  if (p.fixedRate != null && p.fixedRate !== "") {
    const fixed = validateFixedRate(p.fixedRate, live);
    if (fixed.ok) return { rate: fixed.rate, source: "fixed" };
  }
  if (live != null) return { rate: live, source: "live" };
  return null;
}

export interface ConvertibleTransfer {
  from: string;
  to: string;
  krw: number;
}

interface ConvertedTransfer extends ConvertibleTransfer {
  /** 환산 금액(통화의 소수 자릿수에 맞춰 반올림) */
  amount: number;
  currency: string;
}

export type ConvertTransfersResult =
  | {
      ok: true;
      currency: string;
      rate: number;
      items: ConvertedTransfer[];
      /** 환산 금액 합계(항목별 반올림 합). 참고용이라 원화 합과 정확히 맞지 않을 수 있어요. */
      total: number;
    }
  | { ok: false; reason: "bad-currency" | "bad-rate" };

/** KRW → 외화 환산. amount = round(krw / rate) 를 통화 최소 단위로 반올림(half-up). */
export function convertKrw(krw: number, rate: number, currency: string): number {
  const digits = minorUnits(currency);
  const factor = 10 ** digits;
  return roundHalfUp((krw / rate) * factor) / factor;
}

export function convertTransfers(
  transfers: readonly ConvertibleTransfer[],
  p: { currency: string; rate: number }
): ConvertTransfersResult {
  const currency = normalizeCurrencyCode(p.currency);
  if (!currency) return { ok: false, reason: "bad-currency" };
  if (!Number.isFinite(p.rate) || !(p.rate > 0)) {
    return { ok: false, reason: "bad-rate" };
  }

  const items = transfers.map((t) => ({
    from: t.from,
    to: t.to,
    krw: t.krw,
    amount: convertKrw(t.krw, p.rate, currency),
    currency,
  }));
  const digits = minorUnits(currency);
  const factor = 10 ** digits;
  const total =
    roundHalfUp(items.reduce((s, i) => s + i.amount, 0) * factor) / factor;
  return { ok: true, currency, rate: p.rate, items, total };
}

/** 예: "1 JPY = 9.12원". 1 미만 환율은 유효숫자가 보이게 자릿수를 늘린다. */
export function formatRateText(currency: string, rate: number): string {
  const code = currency.trim().toUpperCase();
  const maxDigits =
    rate >= 1 ? 2 : Math.min(6, Math.max(2, Math.ceil(-Math.log10(rate)) + 2));
  const text = rate.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });
  return `1 ${code} = ${text}원`;
}

/** 예: "548 JPY" (통화 소수 자릿수에 맞춘 표기) */
export function formatConvertedAmount(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  const digits = minorUnits(code);
  return `${amount.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${code}`;
}
