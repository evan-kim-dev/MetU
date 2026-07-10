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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F8F9FF]/92 px-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="ai-surface-card flex w-full max-w-[320px] flex-col items-center gap-5 px-6 py-7 text-center shadow-[0_20px_50px_rgba(37,99,235,0.12)]">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span
            className="absolute -inset-2 rounded-full bg-gradient-to-tr from-brand/20 via-[#818CF8]/15 to-transparent blur-2xl motion-safe:animate-pulse"
            aria-hidden
          />
          <span
            className="absolute inset-0 rounded-full motion-safe:animate-[spin_3s_linear_infinite]"
            style={{
              background:
                "conic-gradient(from 0deg, #2563eb, #818cf8, #60a5fa, #2563eb)",
            }}
            aria-hidden
          />
          <span
            className="absolute inset-[3px] flex items-center justify-center rounded-full bg-surface-white shadow-soft"
            aria-hidden
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl ai-gradient-bg shadow-glow">
              <Sparkles className="h-7 w-7 text-white" strokeWidth={2.2} aria-hidden />
            </span>
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="ai-chip">AI 여행 플래너</span>
          <p className="text-lg font-extrabold ai-gradient-text">맞춤 일정 만드는 중</p>
          <p
            className={[
              "min-h-[44px] max-w-[260px] text-sm leading-relaxed text-ink-caption transition-all duration-300",
              visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            ].join(" ")}
          >
            {message}
          </p>
        </div>

        <div className="w-full">
          <div className="h-1.5 overflow-hidden rounded-full bg-brand/10">
            <div className="h-full w-1/3 rounded-full ai-gradient-bg motion-safe:animate-[ai-thinking-slide_1.6s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    </div>
  );
}
