import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary";

interface PrimaryButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    "ai-gradient-bg text-surface-white shadow-glow hover:brightness-105 active:brightness-95",
  secondary:
    "bg-surface-white/90 text-brand-strong border border-line-soft backdrop-blur-sm hover:bg-surface-soft active:brightness-95",
};

const VARIANT_DISABLED_STYLES: Record<Variant, string> = {
  primary: "disabled:bg-line-muted disabled:text-surface-white/80 disabled:shadow-none",
  secondary: "disabled:text-ink-caption disabled:bg-surface-soft",
};

/**
 * 기본 액션 버튼.
 * 온보딩 하단 고정 버튼, 폼 제출 등 전역에서 재사용한다.
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
      ...props
    },
    ref
  ) => {
    const isDisabled = Boolean(disabled || loading);

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        className={[
          "relative inline-flex h-13 min-h-[52px] items-center justify-center overflow-hidden rounded-2xl px-6 text-base font-bold transition-all",
          VARIANT_STYLES[variant],
          loading ? "cursor-wait animate-pulse" : "disabled:cursor-not-allowed",
          !loading ? VARIANT_DISABLED_STYLES[variant] : "",
          fullWidth ? "w-full" : "",
          className,
        ].join(" ")}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent motion-safe:animate-shimmer"
          />
        ) : null}
        <span className="relative inline-flex items-center justify-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} /> : null}
          {children}
        </span>
      </button>
    );
  }
);

PrimaryButton.displayName = "PrimaryButton";
