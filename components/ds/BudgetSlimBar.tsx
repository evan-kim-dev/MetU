"use client";

import { cn } from "@/lib/design/tokens";

export type BudgetSlimSegment = {
  id: string;
  label: string;
  percent: number;
};

export type BudgetSlimBarProps = {
  segments: BudgetSlimSegment[];
  className?: string;
};

/** 표시용 분배 바. 금액 확정이 아니라 UI 비율만 보여요. */
export function BudgetSlimBar({ segments, className }: BudgetSlimBarProps) {
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.percent), 0);
  const tones = [
    "bg-mu-accent",
    "bg-mu-accent-strong",
    "bg-mu-ok",
    "bg-mu-warn",
    "bg-mu-fg-3",
  ] as const;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-mu-sunken"
        role="img"
        aria-label="예산 분배 미리보기"
      >
        {segments.map((seg, i) => {
          const pct = total > 0 ? (Math.max(0, seg.percent) / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={seg.id}
              className={cn("h-full", tones[i % tones.length])}
              style={{ width: `${pct}%` }}
              title={`${seg.label} ${Math.round(pct)}%`}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((seg, i) => (
          <li
            key={seg.id}
            className="flex items-center gap-1.5 text-mu-caption text-mu-fg-3"
          >
            <span
              className={cn("h-2 w-2 rounded-full", tones[i % tones.length])}
              aria-hidden
            />
            <span>
              {seg.label} {seg.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
