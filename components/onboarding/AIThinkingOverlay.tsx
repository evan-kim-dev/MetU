"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const MESSAGES = [
  "예산을 분석하고 있어요",
  "항공·숙소 시세를 맞춰보는 중",
  "취향에 맞는 일정을 짜고 있어요",
  "거의 다 됐어요",
];

interface AIThinkingOverlayProps {
  destination?: string;
}

export function AIThinkingOverlay({ destination }: AIThinkingOverlayProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % MESSAGES.length);
        setVisible(true);
      }, 180);
    }, 2400);
    return () => window.clearInterval(timer);
  }, []);

  const message = destination
    ? `${destination} 여행 기준으로 ${MESSAGES[index]}…`
    : `${MESSAGES[index]}…`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-base/88 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex w-full max-w-[300px] flex-col items-center gap-6 rounded-[28px] bg-white/90 px-7 py-8 text-center shadow-[0_18px_48px_rgba(37,99,235,0.1)]">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span
            className="ai-thinking-ring absolute inset-0 rounded-full opacity-90 motion-safe:animate-[spin_2.8s_linear_infinite]"
            aria-hidden
          />
          <span
            className="absolute inset-[2.5px] flex items-center justify-center rounded-full bg-white"
            aria-hidden
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl ai-gradient-bg">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.2} aria-hidden />
            </span>
          </span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[11px] font-bold tracking-[0.08em] text-brand">
            AI 여행 플래너
          </p>
          <p className="text-lg font-extrabold tracking-tight text-ink-heading">
            맞춤 일정 만드는 중
          </p>
          <p
            className={[
              "mt-1 min-h-[40px] max-w-[240px] text-sm leading-relaxed text-ink-caption transition-all duration-300",
              visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            ].join(" ")}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
