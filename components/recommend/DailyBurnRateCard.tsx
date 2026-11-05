"use client";

import { Info } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  calcDailyBurnAllowance,
  convertKrwToLocal,
} from "@/lib/budget/burn-rate";
import {
  assessDailyPace,
  type PaceStatus,
} from "@/lib/budget/pace";
import { calculateEffectiveFX } from "@/lib/finance/fx-buffer";
import { computeFxDisplayUnit } from "@/lib/fx/currencies";
import { useFxTarget } from "@/lib/fx/useFxTarget";
import { useLiveKrwRate } from "@/lib/fx/useLiveKrwRate";
import { formatKRW } from "@/lib/shared/format";

export type DailyBurnRateCardProps = {
  totalBudget: number;
  /** 항공+숙소 등 고정비 (KRW) */
  fixedCostKRW: number;
  days: number;
  people: number;
  country?: string;
  destination?: string;
  /** 일정 일평균 계획 지출 — 페이스 진단용 */
  plannedDayAverageKRW?: number;
  /**
   * 기준 환율 폴백 (라이브 실패 시).
   * VERIFY: 예시값. 라이브 `/api/fx` 가 우선이에요.
   */
  fallbackBaseRate?: number;
  fallbackCurrencyCode?: string;
  fallbackRateUnit?: number;
  brandFeeRate?: number;
  cardFeeRate?: number;
  volatilityBuffer?: number;
  /**
   * 수수료 출처 라벨. 예: "예시(약관 확인)" · "카드 프로필".
   * 비우면 markup 0 일 때 "수수료 미설정".
   */
  feeSourceLabel?: string;
};

const PACE_COPY: Record<
  PaceStatus,
  { label: string; className: string; hint: (delta: number) => string }
> = {
  under: {
    label: "여유",
    className: "bg-mu-ok-soft text-mu-ok",
    hint: (delta) =>
      `일정 평균이 한도보다 ${formatKRW(Math.abs(delta))} 낮아요.`,
  },
  on_pace: {
    label: "적정",
    className: "bg-mu-accent-soft text-mu-accent",
    hint: () => "일정 평균이 안전 한도 안에 있어요.",
  },
  over: {
    label: "초과",
    className: "bg-mu-warn-soft text-mu-warn",
    hint: (delta) =>
      `일정 평균이 한도보다 ${formatKRW(delta)} 높아요. 리밸런싱을 눌러 보세요.`,
  },
};

export function DailyBurnRateCard({
  totalBudget,
  fixedCostKRW,
  days,
  people,
  country,
  destination,
  plannedDayAverageKRW,
  fallbackBaseRate = 1380,
  fallbackCurrencyCode = "USD",
  fallbackRateUnit = 1,
  brandFeeRate,
  cardFeeRate,
  volatilityBuffer,
  feeSourceLabel,
}: DailyBurnRateCardProps) {
  const tipId = useId();
  const [tipOpen, setTipOpen] = useState(false);

  const { target: fxTarget } = useFxTarget(country, destination);
  const currencyCode = fxTarget?.code ?? fallbackCurrencyCode;
  const { rate: liveRate, loading: fxLoading } = useLiveKrwRate(currencyCode);

  const { dailyKrw, localAmount, markupPercent, effectiveRate, rateUnit, sourceLabel } =
    useMemo(() => {
      const unit =
        fxTarget?.unit && fxTarget.unit > 0
          ? fxTarget.unit
          : liveRate
            ? computeFxDisplayUnit(liveRate.krw)
            : fallbackRateUnit;

      const perUnit = liveRate?.krw ?? fallbackBaseRate / Math.max(1, unit);
      const baseRate = Math.round(perUnit * unit * 100) / 100;

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
        rateUnit: unit,
      });
      return {
        dailyKrw: daily,
        localAmount: local,
        markupPercent: fx.markupPercent,
        effectiveRate: fx.effectiveRate,
        rateUnit: unit,
        sourceLabel: liveRate
          ? liveRate.source === "frankfurter" || liveRate.source === "open.er"
            ? "시장 환율"
            : "참고 환율"
          : "예시 환율",
      };
    }, [
      totalBudget,
      fixedCostKRW,
      days,
      people,
      liveRate,
      fxTarget,
      fallbackBaseRate,
      fallbackRateUnit,
      brandFeeRate,
      cardFeeRate,
      volatilityBuffer,
    ]);

  const pace = useMemo(() => {
    if (plannedDayAverageKRW == null) return null;
    return assessDailyPace({
      plannedDayTotalKRW: plannedDayAverageKRW,
      allowanceKRW: dailyKrw * Math.max(1, people),
    });
  }, [plannedDayAverageKRW, dailyKrw, people]);

  const unitLabel =
    rateUnit > 1
      ? `${rateUnit.toLocaleString("ko-KR")}${currencyCode === "JPY" ? "엔" : currencyCode}`
      : currencyCode;
  const localLabel =
    rateUnit > 1 && (currencyCode === "JPY" || currencyCode === "엔")
      ? `약 ${localAmount.toLocaleString("ko-KR")}엔`
      : `약 ${currencyCode} ${localAmount.toLocaleString("ko-KR")}`;

  const feeBadge =
    markupPercent > 0
      ? `FX +${markupPercent}%`
      : "수수료 미설정";
  const feeTip =
    markupPercent > 0
      ? `${feeSourceLabel ?? "설정 수수료"} 기준 약 ${markupPercent}%를 반영한 보수적 실청구 환율이에요. 약관·카드에 따라 달라질 수 있어요.`
      : "카드 프로필에 해외수수료를 넣으면 실청구 환율에 반영해요. 지금은 기준 환율만 써요.";

  return (
    <div className="relative rounded-mu-xl border border-mu-line bg-mu-card p-5 shadow-mu-float">
      <div className="absolute right-3 top-3 flex items-center gap-1">
        {pace ? (
          <span
            className={`rounded-full px-2.5 py-1 text-mu-caption font-bold ${PACE_COPY[pace.status].className}`}
          >
            {PACE_COPY[pace.status].label}
          </span>
        ) : null}
        <button
          type="button"
          className="inline-flex min-h-tap min-w-[44px] items-center justify-center gap-1 rounded-full bg-mu-accent-soft px-2.5 py-1 text-mu-caption font-bold text-mu-accent"
          aria-describedby={tipId}
          aria-expanded={tipOpen}
          onClick={() => setTipOpen((v) => !v)}
        >
          {feeBadge}
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <p className="pr-28 text-mu-caption font-semibold text-mu-fg-3">
        오늘 하루 자유롭게 쓸 수 있는 안전 한도
      </p>
      <p className="mu-num mt-2 text-mu-amount font-extrabold tracking-tight text-mu-fg">
        {formatKRW(dailyKrw)}
        <span className="ml-1 text-mu-caption font-semibold text-mu-fg-3">
          /인
        </span>
      </p>
      <p className="mt-1 text-mu-body font-bold text-mu-accent">
        {fxLoading && !liveRate ? "환율 불러오는 중…" : localLabel}
      </p>
      <p className="mt-2 text-mu-caption leading-relaxed text-mu-fg-3">
        총예산 − 항공·숙소 ÷ ({Math.max(1, days)}일 × {Math.max(1, people)}인).
        {sourceLabel} 기준 {unitLabel}당 약 ₩
        {effectiveRate.toLocaleString("ko-KR", {
          maximumFractionDigits: 2,
        })}
        이에요.
      </p>
      {pace ? (
        <p className="mt-2 text-mu-caption font-semibold text-mu-fg-2">
          {PACE_COPY[pace.status].hint(pace.deltaKRW)}
        </p>
      ) : null}

      {tipOpen ? (
        <p
          id={tipId}
          role="tooltip"
          className="mt-3 rounded-mu-md border border-mu-line bg-mu-sunken px-3 py-2 text-mu-caption leading-relaxed text-mu-fg-2"
        >
          {feeTip}
        </p>
      ) : (
        <span id={tipId} className="sr-only">
          {feeTip}
        </span>
      )}
    </div>
  );
}
