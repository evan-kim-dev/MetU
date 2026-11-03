"use client";

import { cn } from "@/lib/design/tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-mu-accent text-mu-on-accent hover:bg-mu-accent-strong active:bg-mu-accent-strong",
  secondary:
    "bg-mu-card text-mu-fg border border-mu-line-strong hover:bg-mu-sunken",
  ghost: "bg-transparent text-mu-accent hover:bg-mu-accent-soft",
  danger: "bg-mu-err text-mu-on-accent hover:opacity-90",
};

const SIZE: Record<Size, string> = {
  md: "min-h-tap px-4 text-mu-label rounded-mu-md",
  lg: "min-h-touch h-14 px-5 text-mu-body font-semibold rounded-mu-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "mu-focus inline-flex items-center justify-center gap-2 transition-colors duration-mu-fast ease-mu",
        "disabled:bg-mu-sunken disabled:text-mu-fg-3 disabled:border-transparent disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
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
