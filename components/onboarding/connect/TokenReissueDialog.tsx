"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function TokenReissueDialog({
  open,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reissue-title"
        aria-describedby="reissue-desc"
        className="w-full max-w-md rounded-2xl bg-surface-base p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="reissue-title"
          className="text-base font-extrabold text-ink-heading"
        >
          연결 코드를 다시 만들까요?
        </h2>
        <p id="reissue-desc" className="mt-2 text-sm leading-relaxed text-ink-body">
          이전 연결 코드는 바로 사용이 중지돼요. 이미 단축어에 넣어 둔 코드는
          새 코드로 바꿔야 해요.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            className="min-h-[52px] rounded-2xl bg-red-600 px-4 text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:bg-line-muted disabled:text-ink-caption"
            disabled={busy}
            aria-busy={busy}
            onClick={onConfirm}
          >
            {busy ? "만드는 중…" : "다시 만들기"}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="min-h-11 text-sm font-semibold text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onClick={onCancel}
            disabled={busy}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
