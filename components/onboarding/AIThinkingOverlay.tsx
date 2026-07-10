"use client";

import { useEffect, useState } from "react";
import { MetULogo } from "@/components/ui/MetULogo";

const MESSAGES = [
  "AI가 예산을 분석하고 있어요…",
  "항공·숙소 시세를 맞춰보는 중…",
  "취향에 맞는 일정을 짜고 있어요…",
  "거의 다 됐어요!",
];

interface AIThinkingOverlayProps {
  destination?: string;
}

export function AIThinkingOverlay({ destination }: AIThinkingOverlayProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F8F9FF]/96 backdrop-blur-md">
      <div className="mx-6 flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-brand/10" />
          <div className="relative scale-110">
            <MetULogo variant="appbar" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-lg font-extrabold text-ink-heading">
            AI가 생각 중이에요
          </p>
          <p
            key={index}
            className="min-h-[44px] text-sm leading-relaxed text-ink-caption"
          >
            {destination
              ? `${destination} 여행을 기준으로 ${MESSAGES[index]}`
              : MESSAGES[index]}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
