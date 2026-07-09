"use client";

import { memo, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SmartTip } from "@/lib/mock/home";

interface SmartTipsProps {
  tips: SmartTip[];
  title?: string;
}

/**
 * AI 스마트 팁.
 * overflow-x-auto 로 수평 스크롤되는 카드 목록.
 */
export function SmartTips({ tips, title = "AI Tip" }: SmartTipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByCard = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -240 : 240;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-ink-heading">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="이전 팁"
            onClick={() => scrollByCard("left")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-soft bg-surface-white text-ink-caption transition-colors active:bg-surface-soft"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="다음 팁"
            onClick={() => scrollByCard("right")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-soft bg-surface-white text-ink-caption transition-colors active:bg-surface-soft"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
        {tips.map((tip) => (
          <TipCard key={tip.id} tip={tip} />
        ))}
      </div>
    </div>
  );
}

const TipCard = memo(function TipCard({ tip }: { tip: SmartTip }) {
  return (
    <article className="flex w-56 shrink-0 flex-col gap-2 rounded-2xl border border-line-soft bg-surface-white p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-soft text-lg">
          {tip.emoji}
        </span>
        <span className="text-sm font-bold text-ink-heading">{tip.title}</span>
      </div>
      <p className="text-xs leading-relaxed text-ink-caption">{tip.description}</p>
    </article>
  );
});
