/**
 * 해외결제 실청구 환율 버퍼.
 * 미설정 수수료는 0. 확정 약관 수치를 코드에 박지 않아요.
 * 카드 프로필(`ledger_card_profiles.fee_rate`)은 `feesFromCardProfile` 로 넘기세요.
 * 데모 예시(+2.5%)는 호출 측에서 VERIFY 라벨과 함께 명시적으로만 넘깁니다.
 */

export interface FXBufferOptions {
  /** 기준 환율 (예: 100엔당 910원, 또는 1USD당 원화) */
  baseRate: number;
  /** 비자/마스터 등 브랜드 수수료 (미설정 0) */
  brandFeeRate?: number;
  /** 카드사 해외이용수수료 (미설정 0) */
  cardFeeRate?: number;
  /** 환율 변동 대비 버퍼 (미설정 0) */
  volatilityBuffer?: number;
}

export interface FXBufferResult {
  effectiveRate: number;
  /** 총 마크업 % (예: 2.5) */
  markupPercent: number;
  /** 기준 대비 가산 원화(동일 단위) */
  bufferAmount: number;
}

/**
 * 전신환매도율·해외결제 수수료·변동 버퍼를 감안한 보수적 실청구 환율.
 * 금액(KRW) 계산은 하지 않고 환율만 돌려요.
 */
export function calculateEffectiveFX(options: FXBufferOptions): FXBufferResult {
  const base = options.baseRate;
  if (!(base > 0) || !Number.isFinite(base)) {
    return { effectiveRate: 0, markupPercent: 0, bufferAmount: 0 };
  }

  const brand = options.brandFeeRate ?? 0;
  const card = options.cardFeeRate ?? 0;
  const buffer = options.volatilityBuffer ?? 0;
  const totalMarkup = brand + card + buffer;

  const effectiveRate = Math.round(base * (1 + totalMarkup) * 100) / 100;
  const bufferAmount = Math.round((effectiveRate - base) * 100) / 100;

  return {
    effectiveRate,
    markupPercent: Math.round(totalMarkup * 1000) / 10,
    bufferAmount,
  };
}

/**
 * 카드 프로필 해외수수료율 → FX 버퍼 입력.
 * 브랜드·변동 버퍼는 프로필에 없으므로 0. fee_rate 미설정이면 전부 0.
 */
export function feesFromCardProfile(
  feeRate: number | null | undefined
): Pick<FXBufferOptions, "brandFeeRate" | "cardFeeRate" | "volatilityBuffer"> {
  const card =
    typeof feeRate === "number" && Number.isFinite(feeRate) && feeRate >= 0
      ? feeRate
      : 0;
  return {
    brandFeeRate: 0,
    cardFeeRate: card,
    volatilityBuffer: 0,
  };
}

/**
 * VERIFY: 데모·문서용 예시 합계 약 2.5% (브랜드 1% + 카드 0.2% + 변동 1.3%).
 * 약관 확정값이 아님. UI에 "예시"를 같이 표시하세요.
 */
export const DEMO_EXAMPLE_FX_FEES = {
  brandFeeRate: 0.01,
  cardFeeRate: 0.002,
  volatilityBuffer: 0.013,
} as const;
