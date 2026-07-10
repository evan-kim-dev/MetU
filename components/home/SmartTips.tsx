"use client";

import { memo, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
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
    const amount = direction === "left" ? -260 : 260;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        title={title}
        ai
        rightSlot={
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
        }
      />

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
    <article className="relative flex w-60 shrink-0 flex-col gap-3 overflow-hidden rounded-2xl border border-brand/15 bg-gradient-to-br from-surface-white via-surface-white to-brand/[0.06] p-4 shadow-soft">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-brand/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/12 to-[#818CF8]/12 text-lg">
          {tip.emoji}
        </span>
        <span className="text-sm font-extrabold leading-snug text-ink-heading">
          {tip.title}
        </span>
      </div>
      <p className="relative text-xs leading-relaxed text-ink-caption">
        {tip.description}
      </p>
    </article>
  );
});
