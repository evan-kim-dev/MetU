"use client";

import { formatKRW } from "@/lib/shared/format";
import { cn } from "@/lib/design/tokens";

export type CostPillProps = {
  amount: number;
  unknown?: boolean;
  className?: string;
};

export function CostPill({ amount, unknown = false, className }: CostPillProps) {
  return (
    <span
      className={cn(
        "mu-num inline-flex shrink-0 items-center rounded-mu-sm bg-mu-sunken px-2 py-0.5 text-mu-caption font-medium text-mu-fg-2",
        className
      )}
    >
      {unknown || amount <= 0 ? "미상" : formatKRW(amount)}
    </span>
  );
}
