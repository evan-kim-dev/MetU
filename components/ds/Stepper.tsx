"use client";

import { ChevronLeft, List } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/design/tokens";
import { Sheet } from "./Sheet";

export type StepStatus = "done" | "current" | "todo" | "attention";

export type StepItem = {
  key: string;
  label: string;
  status: StepStatus;
  badge?: string | number;
};

export type StepperProps = {
  steps: StepItem[];
  currentKey: string;
  onSelect: (key: string) => void;
  onBack?: () => void;
  title?: string;
  /** 세그먼트 nav 의 aria-label. 기본 "정산 단계". */
  navAriaLabel?: string;
  className?: string;
};

function statusLabel(s: StepStatus): string {
  switch (s) {
    case "done":
      return "완료";
    case "current":
      return "현재";
    case "attention":
      return "확인 필요";
    default:
      return "남음";
  }
}

export function StepHeader({
  title,
  currentIndex,
  total,
  onBack,
  onOpenList,
}: {
  title: string;
  currentIndex: number;
  total: number;
  onBack?: () => void;
  onOpenList: () => void;
}) {
  return (
    <div className="flex h-14 items-center gap-2 px-2">
      {onBack ? (
        <button
          type="button"
          aria-label="뒤로"
          onClick={onBack}
          className="mu-focus flex h-11 w-11 items-center justify-center rounded-mu-md text-mu-fg"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </button>
      ) : (
        <span className="w-11" />
      )}
      <button
        type="button"
        onClick={onOpenList}
        className="mu-focus min-w-0 flex-1 truncate text-left text-mu-title text-mu-fg"
      >
        {title}
      </button>
      <span className="mu-num shrink-0 px-2 text-mu-label text-mu-fg-3">
        {currentIndex}/{total}
      </span>
      <button
        type="button"
        aria-label="단계 보기"
        onClick={onOpenList}
        className="mu-focus flex h-11 w-11 items-center justify-center rounded-mu-md text-mu-fg-2"
      >
        <List className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

export function Stepper({
  steps,
  currentKey,
  onSelect,
  onBack,
  title,
  navAriaLabel = "정산 단계",
  className,
}: StepperProps) {
  const [listOpen, setListOpen] = useState(false);
  const current = steps.find((s) => s.key === currentKey) ?? steps[0];
  const currentIndex = Math.max(
    1,
    steps.findIndex((s) => s.key === currentKey) + 1
  );
  const heading = title ?? current?.label ?? "";

  return (
    <div className={cn("mu-root border-b border-mu-line bg-mu-card", className)}>
      <StepHeader
        title={heading}
        currentIndex={currentIndex}
        total={steps.length}
        onBack={onBack}
        onOpenList={() => setListOpen(true)}
      />
      <nav aria-label={navAriaLabel} className="px-4 pb-3">
        <ol className="flex gap-1">
          {steps.map((step) => {
            const isCurrent = step.key === currentKey;
            const aria = [
              step.label,
              statusLabel(step.status),
              step.badge != null ? String(step.badge) : null,
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={step.key} className="min-h-tap flex-1">
                <button
                  type="button"
                  aria-label={aria}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => onSelect(step.key)}
                  className="mu-focus flex h-11 w-full flex-col justify-center"
                >
                  <span
                    className={cn(
                      "h-1 w-full rounded-full",
                      step.status === "done" && "bg-mu-accent",
                      step.status === "current" && "bg-mu-accent",
                      step.status === "todo" && "bg-mu-sunken",
                      step.status === "attention" && "bg-mu-warn"
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <Sheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        title="단계 보기"
      >
        <ul className="flex flex-col gap-1">
          {steps.map((step, i) => (
            <li key={step.key}>
              <button
                type="button"
                aria-current={step.key === currentKey ? "step" : undefined}
                onClick={() => {
                  onSelect(step.key);
                  setListOpen(false);
                }}
                className={cn(
                  "mu-focus flex min-h-tap w-full items-center justify-between rounded-mu-md px-3 text-left",
                  step.key === currentKey && "bg-mu-accent-soft"
                )}
              >
                <span className="text-mu-body text-mu-fg">
                  {i + 1}. {step.label}
                </span>
                <span className="text-mu-caption text-mu-fg-3">
                  {statusLabel(step.status)}
                  {step.badge != null ? ` · ${step.badge}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
