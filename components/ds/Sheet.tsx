"use client";

/**
 * mu 스킨 시트. BottomSheet 의 접근성 패턴(포커스 트랩·ESC·스크롤 락·복귀)을
 * 그대로 따르고, 레거시 BottomSheet 파일은 수정하지 않아요.
 */
import { useCallback, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/design/tokens";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  returnFocusRef,
  className,
}: SheetProps) {
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
      const heading = panelRef.current?.querySelector<HTMLElement>("h2");
      (heading ?? panelRef.current)?.focus();
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
        className="absolute inset-0 bg-black/40 motion-safe:animate-[mu-fade-in_var(--mu-dur)_var(--mu-ease)]"
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex max-h-[88dvh] w-full max-w-mobile flex-col overflow-y-auto",
          "rounded-t-mu-xl border border-mu-line bg-mu-card px-4 pt-3 shadow-mu-sheet",
          "pb-[max(16px,env(safe-area-inset-bottom))] focus:outline-none",
          "motion-safe:animate-[mu-sheet-up_var(--mu-dur-slow)_var(--mu-ease)]",
          className
        )}
      >
        <div
          className="mx-auto mb-3 h-1 w-9 rounded-full bg-mu-line-strong"
          aria-hidden
        />
        <h2
          id={titleId}
          tabIndex={-1}
          className="text-mu-heading text-mu-fg outline-none"
        >
          {title}
        </h2>
        <div className="mt-3 flex flex-col gap-3">{children}</div>
        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </div>
  );
}
