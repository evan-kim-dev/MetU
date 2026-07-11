"use client";

import { todayIsoDate } from "@/lib/shared/dates";

type DateFieldProps = {
  value: string;
  min?: string;
  onChange: (next: string) => void;
  className?: string;
  "aria-label"?: string;
};

function clampToMin(value: string, min: string): string {
  if (!value) return value;
  return value < min ? min : value;
}

/**
 * Native date input that cannot go below `min` (default: today).
 * Blocks typing bypass and clamps calendar/paste values.
 */
export function DateField({
  value,
  min,
  onChange,
  className,
  "aria-label": ariaLabel,
}: DateFieldProps) {
  const minDate = min ?? todayIsoDate();

  const commit = (raw: string) => {
    onChange(clampToMin(raw, minDate));
  };

  return (
    <input
      type="date"
      aria-label={ariaLabel}
      value={value}
      min={minDate}
      onChange={(e) => commit(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        // 타이핑으로 min을 우회하지 못하게 캘린더만 허용
        if (e.key === "Tab" || e.key === "Escape") return;
        e.preventDefault();
      }}
      className={className}
    />
  );
}
