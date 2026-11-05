/**
 * 해외결제 실청구 환율 버퍼.
 * VERIFY: brand/card/volatility 기본값은 작성 시점 조사 기준 예시예요.
 * 실제 약관·스프레드는 카드 프로필 설정이 우선이며, 미설정이면 호출 측에서 0을 넘기세요.
 */

export interface FXBufferOptions {
  /** 기준 환율 (예: 100엔당 910원, 또는 1USD당 원화) */
  baseRate: number;
  /** 비자/마스터 등 브랜드 수수료 (기본 0.01 = 1%) */
  brandFeeRate?: number;
  /** 카드사 해외이용수수료 (기본 0.002 = 0.2%) */
  cardFeeRate?: number;
  /** 환율 변동 대비 버퍼 (기본 0.013 = 1.3%) */
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

  const brand = options.brandFeeRate ?? 0.01;
  const card = options.cardFeeRate ?? 0.002;
  const buffer = options.volatilityBuffer ?? 0.013;
  const totalMarkup = brand + card + buffer;

  const effectiveRate = Math.round(base * (1 + totalMarkup) * 100) / 100;
  const bufferAmount = Math.round((effectiveRate - base) * 100) / 100;

  return {
    effectiveRate,
    markupPercent: Math.round(totalMarkup * 1000) / 10,
    bufferAmount,
  };
}
