"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/design/tokens";

export type ToastTone = "neutral" | "ok" | "warn" | "err";

export type ToastShowOptions = {
  text: string;
  action?: { label: string; onClick: () => void };
  tone?: ToastTone;
};

type ToastItem = ToastShowOptions & { id: number };

type ToastContextValue = {
  show: (opts: ToastShowOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASS: Record<ToastTone, string> = {
  neutral: "bg-mu-fg text-mu-on-accent",
  ok: "bg-mu-ok text-mu-on-accent",
  warn: "bg-mu-warn text-mu-on-accent",
  err: "bg-mu-err text-mu-on-accent",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const timerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const remainingRef = useRef(4000);
  const startedAtRef = useRef(0);
  const idRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setItem(null);
  }, [clearTimer]);

  const armTimer = useCallback(
    (ms: number) => {
      clearTimer();
      remainingRef.current = ms;
      startedAtRef.current = Date.now();
      timerRef.current = window.setTimeout(() => {
        if (!pausedRef.current) dismiss();
      }, ms);
    },
    [clearTimer, dismiss]
  );

  const show = useCallback(
    (opts: ToastShowOptions) => {
      idRef.current += 1;
      const next: ToastItem = { ...opts, id: idRef.current };
      setItem(next);
      const ms = opts.action ? 6000 : 4000;
      armTimer(ms);
    },
    [armTimer]
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onPause = () => {
    if (!item || pausedRef.current) return;
    pausedRef.current = true;
    const elapsed = Date.now() - startedAtRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    clearTimer();
  };

  const onResume = () => {
    if (!item || !pausedRef.current) return;
    pausedRef.current = false;
    armTimer(remainingRef.current || 1000);
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {item ? (
        <div
          role="status"
          aria-live="polite"
          onMouseEnter={onPause}
          onMouseLeave={onResume}
          onFocus={onPause}
          onBlur={onResume}
          className={cn(
            "pointer-events-auto fixed inset-x-0 z-50 mx-auto w-[calc(100%-2rem)] max-w-mobile",
            "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] rounded-mu-lg px-4 py-3 shadow-mu-float",
            "motion-safe:animate-[mu-pop_var(--mu-dur)_var(--mu-ease)]",
            TONE_CLASS[item.tone ?? "neutral"]
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-mu-body">{item.text}</p>
            {item.action ? (
              <button
                type="button"
                className="mu-focus shrink-0 text-mu-label underline"
                onClick={() => {
                  item.action?.onClick();
                  dismiss();
                }}
              >
                {item.action.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

/** ToastProvider 밖에서도 렌더될 수 있는 컴포넌트용. Provider 가 없으면 null. */
export function useOptionalToast(): ToastContextValue | null {
  return useContext(ToastContext);
}
