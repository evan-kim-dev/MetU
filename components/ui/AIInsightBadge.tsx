interface AIInsightBadgeProps {
  children: React.ReactNode;
}

/**
 * AI 인사이트 안내 배지.
 */
export function AIInsightBadge({ children }: AIInsightBadgeProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl2 border border-brand/15 bg-gradient-to-br from-brand/6 via-surface-soft to-[#818CF8]/8 px-4 py-3 backdrop-blur-sm">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ai-gradient-bg" aria-hidden />
      <p className="text-sm font-medium leading-relaxed text-brand-strong">{children}</p>
    </div>
  );
}
