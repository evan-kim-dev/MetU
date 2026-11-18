"use client";

import { memo, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { SmartTip } from "@/lib/mock/home";

interface SmartTipsProps {
  tips: SmartTip[];
  title?: string;
}

/** AI 스마트 팁 — 수평 스크롤 카드 목록. */
export function SmartTips({ tips, title = "AI 팁" }: SmartTipsProps) {
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
              className="mu-focus flex h-8 w-8 items-center justify-center rounded-full border border-mu-line bg-mu-card text-mu-fg-3 transition-colors active:bg-mu-sunken"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="다음 팁"
              onClick={() => scrollByCard("right")}
              className="mu-focus flex h-8 w-8 items-center justify-center rounded-full border border-mu-line bg-mu-card text-mu-fg-3 transition-colors active:bg-mu-sunken"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <div
        ref={scrollRef}
        className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1"
      >
        {tips.map((tip) => (
          <TipCard key={tip.id} tip={tip} />
        ))}
      </div>
    </div>
  );
}

const TipCard = memo(function TipCard({ tip }: { tip: SmartTip }) {
  return (
    <article className="flex w-60 shrink-0 flex-col gap-3 rounded-mu-xl border border-mu-line bg-mu-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mu-lg bg-mu-accent-soft text-lg">
          {tip.emoji}
        </span>
        <span className="text-sm font-extrabold leading-snug text-mu-fg">
          {tip.title}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-mu-fg-3">{tip.description}</p>
    </article>
  );
});