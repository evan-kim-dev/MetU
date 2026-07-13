"use client";

import { useEffect, useRef, useState } from "react";
import { PET_BUDDY_SRC } from "@/lib/easter/pet-buddy";

/** 한 보폭(초) — GIF 러닝과 비슷한 리듬 */
const STRIDE_SEC = 0.42;
/** 점프 최고 높이(px) */
const HOP_PEAK = 5;
/** 기본 이동 속도(px/s) */
const BASE_SPEED = 78;

type Props = {
  active: boolean;
};

/**
 * 「프로필 수정」버튼 바로 위 트랙에서 자연스럽게 뛰어다닌다.
 */
export function ProfileDogBuddy({ active }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    x: 0,
    strideT: 0,
    speedJitter: 1,
    lastTs: 0,
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!active || reducedMotion) return;

    const track = trackRef.current;
    const node = nodeRef.current;
    if (!track || !node) return;

    stateRef.current = {
      x: 0,
      strideT: 0,
      speedJitter: 1,
      lastTs: performance.now(),
    };

    const tick = (now: number) => {
      const dogW = node.offsetWidth || 80;
      const maxX = Math.max(0, track.clientWidth - dogW);
      const s = stateRef.current;
      const dt = Math.min(0.05, (now - s.lastTs) / 1000);
      s.lastTs = now;

      s.strideT += dt;
      // 보폭마다 미세한 속도 변화 (숨 쉬는 느낌)
      if (s.strideT >= STRIDE_SEC) {
        s.strideT -= STRIDE_SEC;
        s.speedJitter = 0.92 + Math.random() * 0.16;
      }

      // 착지 직전·직후는 살짝 느려지고, 공중에서 조금 빨라짐
      const phase = s.strideT / STRIDE_SEC;
      const airFactor = 0.88 + 0.24 * Math.sin(phase * Math.PI);
      s.x += BASE_SPEED * s.speedJitter * airFactor * dt;

      if (s.x >= maxX) {
        s.x = 0;
        s.strideT = 0;
      }

      // 포물선 점프: 착지(0)·최고점(중간)·착지(1) — sin보다 자연스러운 도약
      const hop = 4 * HOP_PEAK * phase * (1 - phase);

      node.style.left = `${s.x}px`;
      node.style.bottom = `${hop}px`;

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [active, reducedMotion]);

  if (!active || reducedMotion) return null;

  return (
    <div
      ref={trackRef}
      className="pointer-events-none relative mt-3 h-12 w-full overflow-hidden"
      aria-hidden
    >
      <div
        ref={nodeRef}
        className="absolute bottom-0 left-0 h-12 w-[80px] will-change-[left,bottom]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${PET_BUDDY_SRC.dog}?v=6`}
          alt=""
          width={80}
          height={48}
          draggable={false}
          decoding="async"
          className="h-full w-full select-none object-contain object-bottom drop-shadow-md"
        />
      </div>
    </div>
  );
}
