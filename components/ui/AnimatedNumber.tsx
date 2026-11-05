"use client";

import { useEffect, useState } from "react";
import { formatKRW } from "@/lib/shared/format";

interface AnimatedNumberProps {
  value: number;
  /** ms (기본 800) */
  duration?: number;
  className?: string;
}

/**
 * 0 → 목표 금액까지 easeOutExpo 카운트업.
 * 외부 라이브러리 없음. prefers-reduced-motion 이면 즉시 최종값.
 */
export function AnimatedNumber({
  value,
  duration = 800,
  className = "",
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const endValue = value;
    if (endValue <= 0) {
      setDisplayValue(0);
      return;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplayValue(endValue);
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = 0;
    let frameId = 0;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo: 처음 빠르게, 끝에 부드럽게
      const easeProgress =
        progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(
        startValue + (endValue - startValue) * easeProgress
      );
      setDisplayValue(current);
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [value, duration]);

  return <span className={className}>{formatKRW(displayValue)}</span>;
}
