interface AIInsightBadgeProps {
  children: React.ReactNode;
  variant?: "insight" | "factbomb" | "easter";
  /** true면 본문 대신 로딩 애니메이션만 표시 */
  loading?: boolean;
}

/**
 * AI 인사이트 안내 배지 (cd5c457 aesthetic + loading).
 * Fluid — expands with content, never clamps text.
 */
export function AIInsightBadge({
  children,
  variant = "insight",
  loading = false,
}: AIInsightBadgeProps) {
  const isFactBomb = variant === "factbomb";
  const isEaster = variant === "easter";
  const isSpecial = isFactBomb || isEaster;

  return (
    <div
      className={[
        "flex w-full items-start gap-2.5 rounded-xl2 px-4 py-3 backdrop-blur-sm",
        isEaster
          ? "border border-amber-300/90 bg-gradient-to-br from-amber-50 via-orange-50/80 to-surface-white"
          : isFactBomb
            ? "border border-amber-300/80 bg-gradient-to-br from-amber-50 via-surface-white to-orange-50"
            : "border border-brand/15 bg-gradient-to-br from-brand/6 via-surface-soft to-brand-soft/8",
      ].join(" ")}
      role={loading ? "status" : undefined}
      aria-live={loading ? "polite" : undefined}
      aria-busy={loading || undefined}
    >
      <span
        className={[
          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
          isSpecial ? "bg-amber-500" : "ai-gradient-bg",
          loading ? "motion-safe:animate-pulse" : "",
        ].join(" ")}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        {isSpecial && !loading ? (
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-700">
            {isEaster ? "이스터 에그 발견" : "AI 팩트폭격"}
          </p>
        ) : null}

        {loading ? (
          <div className="flex flex-col gap-2.5 py-0.5" aria-label="AI가 생각 중">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 rounded-full bg-brand motion-safe:animate-[pulse_1s_ease-in-out_infinite]" />
                <span className="h-1.5 w-1.5 rounded-full bg-brand/70 motion-safe:animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
                <span className="h-1.5 w-1.5 rounded-full bg-brand/40 motion-safe:animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
              </span>
              <span className="text-sm font-medium text-ink-caption">
                AI가 생각 중…
              </span>
            </div>
            <div className="flex flex-col gap-2" aria-hidden>
              <div className="h-2 w-full animate-pulse rounded-full bg-brand/15" />
              <div className="h-2 w-[92%] animate-pulse rounded-full bg-brand/10" />
              <div className="h-2 w-[70%] animate-pulse rounded-full bg-brand/10" />
            </div>
          </div>
        ) : (
          <p
            className={[
              "whitespace-pre-wrap break-words text-sm font-medium leading-relaxed",
              isSpecial ? "text-ink-heading" : "text-brand-strong",
            ].join(" ")}
          >
            {children}
          </p>
        )}
      </div>
    </div>
  );
}
