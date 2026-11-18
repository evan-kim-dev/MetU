import { Sparkles } from "lucide-react";

interface AILoadingPanelProps {
  title?: string;
  description?: string;
}

export function AILoadingPanel({
  title = "AI 분석 중",
  description = "잠시만 기다려 주세요",
}: AILoadingPanelProps) {
  return (
    <div
      className="flex flex-col gap-3 rounded-mu-xl border border-mu-line bg-mu-accent-soft px-4 py-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-mu-md bg-mu-accent">
          <Sparkles className="h-5 w-5 text-mu-on-accent" aria-hidden />
          <span
            className="absolute inset-0 rounded-mu-md bg-mu-accent opacity-30 motion-safe:animate-ping"
            aria-hidden
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-mu-accent">{title}</p>
          <p className="text-xs text-mu-fg-3">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2" aria-hidden>
        <div className="h-2.5 w-full animate-pulse rounded-full bg-mu-accent/20" />
        <div className="h-2.5 w-[88%] animate-pulse rounded-full bg-mu-accent/15" />
        <div className="h-2.5 w-[72%] animate-pulse rounded-full bg-mu-accent/15" />
      </div>
    </div>
  );
}
