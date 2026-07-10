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
      className="flex flex-col gap-3 rounded-xl border border-brand/10 bg-gradient-to-br from-brand/5 via-surface-soft to-brand-soft/8 px-4 py-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ai-gradient-bg shadow-glow">
          <Sparkles className="h-5 w-5 text-white" aria-hidden />
          <span
            className="absolute inset-0 rounded-xl ai-gradient-bg opacity-30 motion-safe:animate-ping"
            aria-hidden
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold ai-gradient-text">{title}</p>
          <p className="text-xs text-ink-caption">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2" aria-hidden>
        <div className="h-2.5 w-full animate-pulse rounded-full bg-brand/15" />
        <div className="h-2.5 w-[88%] animate-pulse rounded-full bg-brand/10" />
        <div className="h-2.5 w-[72%] animate-pulse rounded-full bg-brand/10" />
      </div>
    </div>
  );
}
