interface AIInsightBadgeProps {
  children: React.ReactNode;
  variant?: "insight" | "factbomb" | "easter";
  /** true면 인사이트 옆에 로딩 표시 (다음 버튼은 막지 않아요) */
  loading?: boolean;
}

/**
 * AI 인사이트 안내 배지.
 * 로딩 중에도 기존/로컬 인사이트를 유지해 온보딩이 막히지 않게 해요.
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
        "flex w-full items-start gap-2.5 rounded-mu-xl border px-4 py-3",
        isSpecial
          ? "border-mu-warn/40 bg-mu-warn-soft"
          : "border-mu-line bg-mu-accent-soft",
      ].join(" ")}
      role={loading ? "status" : undefined}
      aria-live={loading ? "polite" : undefined}
      aria-busy={loading || undefined}
    >
      <span
        className={[
          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
          isSpecial ? "bg-mu-warn" : "bg-mu-accent",
          loading ? "motion-safe:animate-pulse" : "",
        ].join(" ")}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        {isSpecial ? (
          <p className="mb-1 text-mu-caption font-extrabold tracking-wide text-mu-warn">
            {isEaster ? "이스터 에그 발견" : "AI 팩트폭격"}
          </p>
        ) : null}

        {loading ? (
          <p className="mb-1.5 text-mu-caption font-semibold text-mu-fg-3">
            AI가 생각 중… 바로 다음으로 넘어가도 돼요
          </p>
        ) : null}

        <p
          className={[
            "whitespace-pre-wrap break-words text-sm font-medium leading-relaxed",
            isSpecial ? "text-mu-fg" : "text-mu-accent",
            loading ? "opacity-80" : "",
          ].join(" ")}
        >
          {children}
        </p>
      </div>
    </div>
  );
}
