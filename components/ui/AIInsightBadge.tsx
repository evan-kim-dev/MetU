interface AIInsightBadgeProps {
  children: React.ReactNode;
  variant?: "insight" | "factbomb";
}

/**
 * AI 인사이트 안내 배지.
 */
export function AIInsightBadge({
  children,
  variant = "insight",
}: AIInsightBadgeProps) {
  const isFactBomb = variant === "factbomb";

  return (
    <div
      className={[
        "flex items-start gap-2.5 rounded-xl2 px-4 py-3 backdrop-blur-sm",
        isFactBomb
          ? "border border-amber-300/80 bg-gradient-to-br from-amber-50 via-surface-white to-orange-50"
          : "border border-brand/15 bg-gradient-to-br from-brand/6 via-surface-soft to-[#818CF8]/8",
      ].join(" ")}
    >
      <span
        className={[
          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
          isFactBomb ? "bg-amber-500" : "ai-gradient-bg",
        ].join(" ")}
        aria-hidden
      />
      <div className="min-w-0">
        {isFactBomb ? (
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-700">
            AI 팩트폭격
          </p>
        ) : null}
        <p
          className={[
            "text-sm font-medium leading-relaxed",
            isFactBomb ? "text-ink-heading" : "text-brand-strong",
          ].join(" ")}
        >
          {children}
        </p>
      </div>
    </div>
  );
}
