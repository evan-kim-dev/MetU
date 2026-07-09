import { Sparkles } from "lucide-react";

interface AIInsightBadgeProps {
  children: React.ReactNode;
}

/**
 * AI 인사이트 안내 배지.
 * 브랜드 톤의 은은한 배경 위에 반짝임 아이콘과 문구를 노출한다.
 */
export function AIInsightBadge({ children }: AIInsightBadgeProps) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-line-soft bg-surface-soft px-4 py-3">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.4} />
      <p className="text-sm font-medium leading-relaxed text-brand-strong">
        {children}
      </p>
    </div>
  );
}
