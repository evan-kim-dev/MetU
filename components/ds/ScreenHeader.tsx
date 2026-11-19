"use client";

import { cn } from "@/lib/design/tokens";

export type ScreenHeaderProps = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  title?: string;
  /** 1-based current step for progress dots */
  step?: number;
  totalSteps?: number;
  className?: string;
};

export function ScreenHeader({
  left,
  center,
  right,
  title,
  step,
  totalSteps,
  className,
}: ScreenHeaderProps) {
  const showDots =
    typeof step === "number" &&
    typeof totalSteps === "number" &&
    totalSteps > 0;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-mu-line bg-mu-card/95 px-5 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex min-w-[44px] shrink-0 items-center justify-start">
        {left}
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1">
        {center ? (
          center
        ) : showDots ? (
          <div className="flex items-center gap-1.5" aria-label={`${totalSteps}단계 중 ${step}단계`}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors duration-mu-fast",
                  i + 1 <= step! ? "bg-mu-accent" : "bg-mu-line-strong/40"
                )}
              />
            ))}
          </div>
        ) : title ? (
          <h1 className="truncate text-center text-mu-body font-semibold text-mu-fg">
            {title}
          </h1>
        ) : null}
      </div>
      <div className="flex min-w-[44px] shrink-0 items-center justify-end">
        {right}
      </div>
    </header>
  );
}
