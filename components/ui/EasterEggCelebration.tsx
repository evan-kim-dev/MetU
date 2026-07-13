"use client";

import { useEffect, useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";

interface EasterEggCelebrationProps {
  open: boolean;
  destination: string;
  onClose: () => void;
}

type BurstParticle = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  drift: number;
  color: string;
  size: number;
};

const BURST_COLORS = [
  "#F59E0B",
  "#F97316",
  "#0EA5A4",
  "#2563EB",
  "#E11D48",
  "#CA8A04",
];

function buildParticles(count: number): BurstParticle[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: 8 + ((id * 17) % 84),
    delay: (id % 12) * 0.08,
    duration: 1.35 + (id % 5) * 0.18,
    drift: -40 + ((id * 23) % 80),
    color: BURST_COLORS[id % BURST_COLORS.length],
    size: 5 + (id % 4) * 2,
  }));
}

/**
 * 이스터 에그 목적지 발견 시 폭죽 + 축하 팝업.
 */
export function EasterEggCelebration({
  open,
  destination,
  onClose,
}: EasterEggCelebrationProps) {
  const titleId = useId();
  const particles = useMemo(() => buildParticles(28), []);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    const timer = window.setTimeout(onClose, 5200);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-ink-heading/45 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="egg-firework-stage pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        {particles.map((p) => (
          <span
            key={p.id}
            className="egg-firework-particle"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--egg-drift" as string]: `${p.drift}px`,
            }}
          />
        ))}
        <span className="egg-firework-flash" />
      </div>

      <div className="egg-celeb-card relative z-10 w-full max-w-[320px] overflow-hidden rounded-3xl border border-amber-200/80 bg-surface-white px-5 pb-5 pt-6 text-center shadow-soft">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-caption transition-colors hover:bg-surface-soft hover:text-ink-heading"
          aria-label="축하 닫기"
        >
          <X className="h-4 w-4" strokeWidth={2.4} />
        </button>

        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 motion-safe:animate-[egg-pop_0.55s_cubic-bezier(0.22,1.4,0.36,1)_both]">
          <Sparkles className="h-7 w-7" strokeWidth={2.2} aria-hidden />
        </div>

        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-700">
          Easter Egg
        </p>
        <h2
          id={titleId}
          className="mt-1.5 text-xl font-extrabold leading-snug text-ink-heading"
        >
          이스터 에그 발견!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-body">
          <span className="font-bold text-brand-strong">{destination}</span>
          은(는) 숨겨진 목적지예요. MetU가 특별히 반응했어요.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-brand text-sm font-bold text-surface-white transition-transform active:scale-[0.99]"
        >
          결과 보기
        </button>
      </div>
    </div>,
    document.body
  );
}
