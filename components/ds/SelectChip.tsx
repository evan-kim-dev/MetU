"use client";

import { cn } from "@/lib/design/tokens";

export type SelectChipProps = {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** 읽기 전용 표시 칩(클릭 없음) */
  readOnly?: boolean;
};

export function SelectChip({
  label,
  selected = false,
  onClick,
  disabled = false,
  className,
  readOnly = false,
}: SelectChipProps) {
  const classes = cn(
    "inline-flex min-h-tap items-center justify-center rounded-mu-md border px-3 py-2 text-mu-label transition-colors duration-mu-fast",
    selected
      ? "border-mu-accent bg-mu-accent-soft font-semibold text-mu-accent-strong"
      : "border-mu-line bg-mu-card text-mu-fg-2",
    !readOnly && !disabled && "active:scale-[0.98]",
    disabled && "cursor-not-allowed opacity-50",
    className
  );

  if (readOnly) {
    return <span className={classes}>{label}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn("mu-focus", classes)}
    >
      {label}
    </button>
  );
}
