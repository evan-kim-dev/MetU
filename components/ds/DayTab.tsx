"use client";

import { cn } from "@/lib/design/tokens";

export type DayTabItem = {
  key: string;
  label: string;
};

export type DayTabProps = {
  items: DayTabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
};

export function DayTab({ items, value, onChange, className }: DayTabProps) {
  return (
    <div
      role="tablist"
      aria-label="일차 선택"
      className={cn(
        "flex gap-2 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.key)}
            className={cn(
              "mu-focus shrink-0 rounded-mu-md border px-4 py-2 text-mu-label transition-colors duration-mu-fast",
              "min-h-tap",
              selected
                ? "border-mu-accent bg-mu-accent text-mu-on-accent font-semibold"
                : "border-mu-line bg-mu-card text-mu-fg-2"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
