"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

type AuthMessageKind = "error" | "info" | "success";

interface AuthMessageAction {
  label: string;
  onClick: () => void;
}

interface AuthMessageProps {
  kind: AuthMessageKind;
  children: ReactNode;
  onDismiss?: () => void;
  action?: AuthMessageAction;
  className?: string;
}

const kindStyles: Record<AuthMessageKind, string> = {
  error:
    "border-danger-border bg-red-50 text-red-800 dark:border-danger-border dark:bg-red-950/40 dark:text-red-100",
  info: "border-brand/20 bg-brand/5 text-brand-strong",
  success: "border-brand/20 bg-brand/5 text-brand-strong",
};

export function AuthMessage({
  kind,
  children,
  onDismiss,
  action,
  className = "",
}: AuthMessageProps) {
  const role = kind === "error" ? "alert" : "status";

  return (
    <div
      role={role}
      className={[
        "relative rounded-xl border px-3 py-2 text-center text-xs font-medium backdrop-blur-sm animate-fade-up",
        kindStyles[kind],
        className,
      ].join(" ")}
    >
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="닫기"
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      <div className={onDismiss ? "px-6" : undefined}>{children}</div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 min-h-touch w-full rounded-lg border border-current/20 bg-white/80 px-3 py-2 text-sm font-bold text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
