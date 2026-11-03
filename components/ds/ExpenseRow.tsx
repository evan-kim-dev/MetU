"use client";

import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/design/tokens";
import { formatKRW } from "@/lib/shared/format";

export type ExpenseRowProps = {
  merchant: string;
  amount: number;
  meta?: string;
  status?: "review" | "pending" | null;
  statusLabel?: string;
  icon?: React.ReactNode;
  chips?: React.ReactNode;
  onClick?: () => void;
  menu?: React.ReactNode;
  onMenuOpen?: () => void;
  className?: string;
};

export function ExpenseRow({
  merchant,
  amount,
  meta,
  status = null,
  statusLabel,
  icon,
  chips,
  onClick,
  menu,
  onMenuOpen,
  className,
}: ExpenseRowProps) {
  const formatted = formatKRW(amount);
  const label = [merchant, meta, formatted].filter(Boolean).join(", ");

  return (
    <div
      className={cn(
        "flex min-h-16 flex-col gap-2 border-b border-mu-line py-3 last:border-b-0",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="mu-focus flex min-h-tap min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mu-sunken text-mu-fg-2">
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-mu-body font-semibold text-mu-fg">
              {merchant}
            </span>
            {meta ? (
              <span className="mt-0.5 block truncate text-mu-caption text-mu-fg-3">
                {meta}
              </span>
            ) : null}
            {status ? (
              <span
                className={cn(
                  "mt-1 inline-flex rounded-mu-sm px-2 py-0.5 text-mu-caption",
                  status === "review" && "bg-mu-warn-soft text-mu-warn",
                  status === "pending" && "bg-mu-accent-soft text-mu-accent"
                )}
              >
                {statusLabel ??
                  (status === "review" ? "확인 필요" : "제안 대기")}
              </span>
            ) : null}
          </span>
          <span className="mu-num shrink-0 text-mu-body font-bold text-mu-fg">
            {formatted}
          </span>
        </button>
        {onMenuOpen || menu ? (
          <button
            type="button"
            aria-label="더보기"
            onClick={onMenuOpen}
            className="mu-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-mu-md text-mu-fg-2"
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>
      {chips ? (
        <div className="flex flex-wrap gap-2 pl-[3.25rem]">{chips}</div>
      ) : null}
      {menu}
    </div>
  );
}
