"use client";

import { cn } from "@/lib/design/tokens";
import { Button } from "./Button";

export type BottomCTAProps = {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: { label: string; onClick: () => void };
  hint?: string;
  className?: string;
};

export function BottomCTA({
  label,
  onClick,
  loading = false,
  disabled = false,
  secondary,
  hint,
  className,
}: BottomCTAProps) {
  const hintId = hint ? "mu-bottom-cta-hint" : undefined;
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-mobile border-t border-mu-line bg-mu-card shadow-mu-sheet",
        "px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]",
        className
      )}
    >
      {hint ? (
        <p
          id={hintId}
          className="mb-2 text-center text-mu-caption text-mu-fg-3"
        >
          {hint}
        </p>
      ) : null}
      {secondary ? (
        <button
          type="button"
          onClick={secondary.onClick}
          className="mu-focus mb-2 w-full py-2 text-center text-mu-label text-mu-accent"
        >
          {secondary.label}
        </button>
      ) : null}
      <Button
        size="lg"
        variant="primary"
        className="w-full rounded-mu-lg"
        onClick={onClick}
        loading={loading}
        disabled={disabled}
        aria-describedby={hintId}
      >
        {label}
      </Button>
    </div>
  );
}
