"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  detectPetBuddiesFromBio,
  PET_BUDDY_LABEL,
  PET_BUDDY_SRC,
  type PetBuddyKind,
} from "@/lib/easter/pet-buddy";

type Point = { x: number; y: number };

const OFFSETS: Record<PetBuddyKind, { x: number; y: number }> = {
  cat: { x: 18, y: 18 },
  dog: { x: 28, y: -8 },
};

/**
 * 프로필 소개에 고양이/강아지가 있으면 커서를 따라다니는 펫.
 */
export function PetCursorFollower() {
  const { profile } = useProfile();
  const petsKey = useMemo(
    () => detectPetBuddiesFromBio(profile.bio).join(","),
    [profile.bio]
  );
  const pets = useMemo(
    () => (petsKey ? (petsKey.split(",") as PetBuddyKind[]) : []),
    [petsKey]
  );
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const targetRef = useRef<Point>({ x: -999, y: -999 });
  const currentRef = useRef<Record<PetBuddyKind, Point>>({
    cat: { x: -999, y: -999 },
    dog: { x: -999, y: -999 },
  });
  const nodeRefs = useRef<Partial<Record<PetBuddyKind, HTMLDivElement | null>>>(
    {}
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (pets.length === 0 || reducedMotion) {
      setVisible(false);
      return;
    }

    const onMove = (clientX: number, clientY: number) => {
      targetRef.current = { x: clientX, y: clientY };
      setVisible(true);
    };

    const onPointerMove = (e: PointerEvent) => {
      onMove(e.clientX, e.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) onMove(t.clientX, t.clientY);
    };
    const onLeave = () => setVisible(false);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    const tick = () => {
      const target = targetRef.current;
      for (const kind of pets) {
        const cur = currentRef.current[kind];
        const offset = OFFSETS[kind];
        const nextX = cur.x + (target.x + offset.x - cur.x) * 0.18;
        const nextY = cur.y + (target.y + offset.y - cur.y) * 0.18;
        currentRef.current[kind] = { x: nextX, y: nextY };
        const node = nodeRefs.current[kind];
        if (node) {
          node.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
        }
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [pets, reducedMotion]);

  if (!mounted || pets.length === 0 || reducedMotion) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[190] overflow-hidden"
      aria-hidden
    >
      {pets.map((kind) => (
        <div
          key={kind}
          ref={(el) => {
            nodeRefs.current[kind] = el;
          }}
          className={[
            "absolute left-0 top-0 will-change-transform",
            visible ? "opacity-100" : "opacity-0",
            "transition-opacity duration-200",
          ].join(" ")}
          style={{ transform: "translate3d(-999px, -999px, 0)" }}
        >
          <Image
            src={PET_BUDDY_SRC[kind]}
            alt=""
            width={56}
            height={56}
            draggable={false}
            className="h-14 w-14 select-none drop-shadow-md"
            priority
          />
          <span className="sr-only">{PET_BUDDY_LABEL[kind]} 버디</span>
        </div>
      ))}
    </div>,
    document.body
  );
}
