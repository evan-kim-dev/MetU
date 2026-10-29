"use client";

import { dayColor } from "@/lib/map/day-colors";

interface PinBadgeProps {
  day: number;
  order: number;
  highlighted?: boolean;
  spendLabel?: string;
  spendTier?: 0 | 1 | 2 | 3;
}

const RING: Record<0 | 1 | 2 | 3, string> = {
  0: "0",
  1: "2px",
  2: "3px",
  3: "4px",
};

export function PinBadge({
  day,
  order,
  highlighted,
  spendLabel,
  spendTier = 0,
}: PinBadgeProps) {
  const color = dayColor(day - 1);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        style={{
          backgroundColor: color,
          boxShadow: highlighted
            ? `0 0 0 3px rgba(255,255,255,0.95), 0 0 0 6px ${color}`
            : spendTier
              ? `0 0 0 ${RING[spendTier]} rgba(15,23,42,0.25)`
              : "0 1px 3px rgba(0,0,0,0.35)",
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
      >
        {order}
      </div>
      {spendLabel ? (
        <span className="rounded bg-white/95 px-1 py-0.5 text-[10px] font-bold text-ink-heading shadow">
          {spendLabel}
        </span>
      ) : null}
    </div>
  );
}
