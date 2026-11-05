"use client";

import { Info } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  calcDailyBurnAllowance,
  convertKrwToLocal,
} from "@/lib/budget/burn-rate";
import { calculateEffectiveFX } from "@/lib/finance/fx-buffer";
import { formatKRW } from "@/lib/shared/format";

export type DailyBurnRateCardProps = {
  totalBudget: number;
  /** 항공+숙소 등 고정비 (KRW) */
  fixedCostKRW: number;
  days: number;
  people: number;
  /**
   * 기준 환율. JPY 면 보통 100엔당 원화.
   * VERIFY: 호출 측에서 라이브/캐시 환율을 넘기세요. 기본은 표시용 예시값.
   */
  baseRate: number;
  /** 현지 통화 코드 (표시용) */
  currencyCode: string;
  /** baseRate 가 가리키는 외화 단위 (엔=100, 달러=1) */
  rateUnit?: number;
  brandFeeRate?: number;
  cardFeeRate?: number;
  volatilityBuffer?: number;
};

export function DailyBurnRateCard({
  totalBudget,
  fixedCostKRW,
  days,
  people,
  baseRate,
  currencyCode,
  rateUnit = 1,
  brandFeeRate,
  cardFeeRate,
  volatilityBuffer,
}: DailyBurnRateCardProps) {
  const tipId = useId();
  const [tipOpen, setTipOpen] = useState(false);

  const { dailyKrw, localAmount, markupPercent, effectiveRate } = useMemo(() => {
    const fx = calculateEffectiveFX({
      baseRate,
      brandFeeRate,
      cardFeeRate,
      volatilityBuffer,
    });
    const daily = calcDailyBurnAllowance({
      totalBudget,
      fixedCostKRW,
      days,
      people,
    });
    const local = convertKrwToLocal({
      amountKRW: daily,
      effectiveRate: fx.effectiveRate,
      rateUnit,
    });
    return {
      dailyKrw: daily,
      localAmount: local,
      markupPercent: fx.markupPercent,
      effectiveRate: fx.effectiveRate,
    };
  }, [
    totalBudget,
    fixedCostKRW,
    days,
    people,
    baseRate,
    brandFeeRate,
    cardFeeRate,
    volatilityBuffer,
    rateUnit,
  ]);

  const unitLabel =
    rateUnit > 1
      ? `${rateUnit.toLocaleString("ko-KR")}${currencyCode}`
      : currencyCode;
  const localLabel =
    rateUnit > 1
      ? `약 ${localAmount.toLocaleString("ko-KR")}${currencyCode}`
      : `약 ${currencyCode} ${localAmount.toLocaleString("ko-KR")}`;

  return (
    <div className="relative rounded-mu-xl border border-mu-line bg-mu-card p-5 shadow-mu-float">
      <div className="absolute right-3 top-3">
        <button
          type="button"
          className="inline-flex min-h-tap min-w-[44px] items-center justify-center gap-1 rounded-full bg-mu-accent-soft px-2.5 py-1 text-mu-caption font-bold text-mu-accent"
          aria-describedby={tipId}
          aria-expanded={tipOpen}
          onClick={() => setTipOpen((v) => !v)}
        >
          FX +{markupPercent}%
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <p className="pr-24 text-mu-caption font-semibold text-mu-fg-3">
        오늘 하루 자유롭게 쓸 수 있는 안전 한도
      </p>
      <p className="mu-num mt-2 text-mu-amount font-extrabold tracking-tight text-mu-fg">
        {formatKRW(dailyKrw)}
      </p>
      <p className="mt-1 text-mu-body font-bold text-mu-accent">{localLabel}</p>
      <p className="mt-2 text-mu-caption leading-relaxed text-mu-fg-3">
        총예산 − 항공·숙소 ÷ ({Math.max(1, days)}일 × {Math.max(1, people)}인).
        실청구 환율은 {unitLabel}당 약 ₩
        {effectiveRate.toLocaleString("ko-KR", {
          maximumFractionDigits: 2,
        })}{" "}
        기준이에요.
      </p>

      {tipOpen ? (
        <p
          id={tipId}
          role="tooltip"
          className="mt-3 rounded-mu-md border border-mu-line bg-mu-sunken px-3 py-2 text-mu-caption leading-relaxed text-mu-fg-2"
        >
          브랜드·카드 해외수수료와 환율 변동 버퍼(예시 합계 약 {markupPercent}
          %)를 반영한 보수적 실청구 환율이에요. 약관·카드 설정에 따라 달라질 수
          있어요.
        </p>
      ) : (
        <span id={tipId} className="sr-only">
          해외결제 수수료·환율 변동 버퍼를 반영한 실청구 환율 배지예요.
        </span>
      )}
    </div>
  );
}
