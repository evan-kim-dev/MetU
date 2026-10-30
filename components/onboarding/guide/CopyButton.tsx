"use client";

import { useCallback, useRef, useState } from "react";

type CopyButtonProps = {
  text: string;
  label?: string;
  className?: string;
};

export function CopyButton({
  text,
  label = "복사",
  className = "",
}: CopyButtonProps) {
  const [status, setStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [busy, setBusy] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  const resetLater = useCallback(() => {
    window.setTimeout(() => setStatus("idle"), 2000);
  }, []);

  const copy = useCallback(() => {
    if (busy) return;
    setBusy(true);

    const attempt = async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          setStatus("ok");
          resetLater();
          return;
        }
      } catch {
        /* fall through */
      }

      const ta = fallbackRef.current;
      if (ta) {
        ta.value = text;
        ta.select();
        try {
          const ok = document.execCommand("copy");
          if (ok) {
            setStatus("ok");
            resetLater();
            return;
          }
        } catch {
          /* fall through */
        }
      }

      setStatus("fail");
    };

    void attempt().finally(() => setBusy(false));
  }, [busy, resetLater, text]);

  const buttonLabel =
    status === "ok" ? "복사했어요 ✓" : status === "fail" ? label : label;

  return (
    <div className={className}>
      <textarea
        ref={fallbackRef}
        readOnly
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <button
        type="button"
        onClick={copy}
        disabled={busy}
        aria-busy={busy}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-surface-soft px-3 py-2 text-sm font-medium text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {buttonLabel}
      </button>
      {status === "fail" ? (
        <p className="mt-1 text-xs text-ink-muted" role="status">
          길게 눌러 복사해 주세요
        </p>
      ) : status === "ok" ? (
        <span className="sr-only" role="status">
          복사했어요
        </span>
      ) : null}
    </div>
  );
}
