"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/design/tokens";

export type MemberChipProps = {
  name: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  avatar?: React.ReactNode;
  className?: string;
};

export function MemberChip({
  name,
  selected,
  onToggle,
  disabled = false,
  avatar,
  className,
}: MemberChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "mu-focus inline-flex h-11 min-h-tap items-center gap-2 rounded-full px-4 text-mu-label transition-colors duration-mu-fast ease-mu",
        selected
          ? "bg-mu-accent-soft text-mu-accent"
          : "bg-mu-sunken text-mu-fg-2",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {avatar}
      <span>{name}</span>
      {selected ? (
        <Check className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      ) : null}
    </button>
  );
}
