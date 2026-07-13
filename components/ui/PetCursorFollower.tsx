"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { PET_BUDDY_SRC } from "@/lib/easter/pet-buddy";

const SIZE = 80;
const OFFSET = { x: -60, y: -56 };

type Props = {
  /** 이 컨테이너 안에서만 커서를 따라다님 */
  containerRef: RefObject<HTMLElement | null>;
  active: boolean;
};

/**
 * 내 프로필 페이지 전체에서만 고양이 GIF가 커서를 따라다닌다.
 */
export function PetCursorFollower({ containerRef, active }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef({ x: 12, y: 12 });
  const currentRef = useRef({ x: 12, y: 12 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!active || reducedMotion) {
      setVisible(false);
      return;
    }

    const host = containerRef.current;
    if (!host) return;

    const clamp = (x: number, y: number) => {
      const maxX = Math.max(0, host.clientWidth - SIZE);
      const maxY = Math.max(0, host.clientHeight - SIZE);
      return {
        x: Math.min(maxX, Math.max(0, x)),
        y: Math.min(maxY, Math.max(0, y)),
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) {
        setVisible(false);
        return;
      }
      targetRef.current = clamp(
        e.clientX - rect.left + OFFSET.x,
        e.clientY - rect.top + OFFSET.y
      );
      setVisible(true);
    };

    const onLeave = () => setVisible(false);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);

    const tick = () => {
      const cur = currentRef.current;
      const t = targetRef.current;
      const next = {
        x: cur.x + (t.x - cur.x) * 0.18,
        y: cur.y + (t.y - cur.y) * 0.18,
      };
      currentRef.current = next;
      const node = nodeRef.current;
      if (node) {
        node.style.left = `${next.x}px`;
        node.style.top = `${next.y}px`;
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onLeave);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [active, reducedMotion, containerRef]);

  if (!active || reducedMotion) return null;

  return (
    <div
      ref={nodeRef}
      className="pointer-events-none absolute z-20"
      style={{
        left: 12,
        top: 12,
        width: SIZE,
        height: SIZE,
        visibility: visible ? "visible" : "hidden",
      }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${PET_BUDDY_SRC.cat}?v=4`}
        alt=""
        width={SIZE}
        height={SIZE}
        draggable={false}
        decoding="async"
        className="h-full w-full select-none object-contain drop-shadow-md"
      />
    </div>
  );
}
