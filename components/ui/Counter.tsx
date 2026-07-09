"use client";

import { Minus, Plus } from "lucide-react";

interface CounterProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** 값 뒤에 붙는 단위 (예: "명") */
  unit?: string;
  variant?: "default" | "compact";
}

/**
 * +/- 버튼 기반 Increment/Decrement 컨트롤.
 */
export function Counter({
  value,
  onChange,
  min = 1,
  max = 99,
  unit = "",
  variant = "default",
}: CounterProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  if (variant === "compact") {
    const compactBtn =
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-surface-white text-ink-heading transition-colors active:bg-surface-soft disabled:opacity-40";

    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={dec}
          disabled={value <= min}
          aria-label="인원 감소"
          className={compactBtn}
        >
          <Minus className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <div className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg border border-line-soft bg-surface-white px-2 text-sm font-semibold tabular-nums text-ink-heading">
          {value}
          {unit ? <span className="ml-0.5 text-xs font-medium text-ink-caption">{unit}</span> : null}
        </div>
        <button
          type="button"
          onClick={inc}
          disabled={value >= max}
          aria-label="인원 증가"
          className={compactBtn}
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>
    );
  }

  const btnBase =
    "flex h-12 w-12 items-center justify-center rounded-full border border-line-soft bg-surface-white text-ink-heading transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100";

  return (
    <div className="flex items-center justify-between rounded-2xl border border-line-soft bg-surface-soft/50 p-3">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="감소"
        className={btnBase}
      >
        <Minus className="h-5 w-5" strokeWidth={2.4} />
      </button>

      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-extrabold tabular-nums text-ink-heading">
          {value}
        </span>
        {unit && (
          <span className="text-base font-semibold text-ink-caption">
            {unit}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="증가"
        className={btnBase}
      >
        <Plus className="h-5 w-5" strokeWidth={2.4} />
      </button>
    </div>
  );
}
