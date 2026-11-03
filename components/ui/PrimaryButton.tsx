"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/design/tokens";

type Variant = "primary" | "secondary";

interface PrimaryButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-mu-accent text-mu-on-accent hover:bg-mu-accent-strong active:bg-mu-accent-strong",
  secondary:
    "bg-mu-card text-mu-fg border border-mu-line-strong hover:bg-mu-sunken",
};

/**
 * 레거시 진입점. ds Button 과 같은 플랫 단색(그라디언트·글로우 제거).
 * import 경로·props 는 유지해요.
 */
export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  (
    {
      variant = "primary",
      fullWidth = true,
      loading = false,
      className = "",
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = Boolean(disabled || loading);

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          "mu-focus relative inline-flex h-14 min-h-touch items-center justify-center gap-2 rounded-mu-lg px-5 text-mu-body font-semibold transition-colors duration-mu-fast ease-mu",
          "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-mu-sunken disabled:text-mu-fg-3",
          VARIANT[variant],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading ? (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden
          />
        ) : null}
        {children}
      </button>
    );
  }
);

PrimaryButton.displayName = "PrimaryButton";
