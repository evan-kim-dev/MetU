"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface HorizontalScrollerProps {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

/**
 * 가로 슬라이드 영역.
 * - 터치/트랙패드 스크롤
 * - 마우스 드래그 스크롤
 * - 양끝 페이드로 가려진 콘텐츠 힌트
 */
export function HorizontalScroller({
  children,
  className = "",
  "aria-label": ariaLabel,
}: HorizontalScrollerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateEdges = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(max > 2 && el.scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });

    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateEdges);
      resizeObserver.disconnect();
    };
  }, [updateEdges, children]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("button, a, input, textarea, select, [role='button']")
      ) {
        return;
      }
      dragRef.current = {
        active: true,
        moved: false,
        startX: event.clientX,
        scrollLeft: el.scrollLeft,
      };
      el.setPointerCapture(event.pointerId);
      el.classList.add("cursor-grabbing");
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dx = event.clientX - dragRef.current.startX;
      if (Math.abs(dx) > 4) dragRef.current.moved = true;
      el.scrollLeft = dragRef.current.scrollLeft - dx;
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      el.classList.remove("cursor-grabbing");
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!dragRef.current.moved) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current.moved = false;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <div
        ref={ref}
        aria-label={ariaLabel}
        className="no-scrollbar flex cursor-grab gap-2 overflow-x-auto overscroll-x-contain touch-pan-x select-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>

      {canScrollLeft ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface-base to-transparent"
        />
      ) : null}
      {canScrollRight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface-base to-transparent"
        />
      ) : null}
    </div>
  );
}
