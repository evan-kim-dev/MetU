"use client";

import { useCallback, useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** 닫힐 때 포커스를 돌려줄 요소. 없으면 열기 직전 포커스 요소로 돌려요. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 하단 시트 (새 의존성 없이 직접 구현).
 * role="dialog" aria-modal, ESC·배경 탭으로 닫기, 열릴 때 포커스 이동·닫힐 때 복귀,
 * 스크롤 잠금, 하단 safe-area 패딩. QuickTripSheet 의 접근성 패턴을 따라요.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  returnFocusRef,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => onCloseRef.current(), []);

  useEffect(() => {
    if (!open) return;
    const returnEl =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      returnEl?.focus();
    };
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable =
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="닫기"
        tabIndex={-1}
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 flex max-h-[88dvh] w-full max-w-mobile flex-col overflow-y-auto rounded-t-3xl bg-surface-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-soft focus:outline-none"
      >
        <h2 id={titleId} className="text-lg font-extrabold text-ink-heading">
          {title}
        </h2>
        <div className="mt-3 flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}
