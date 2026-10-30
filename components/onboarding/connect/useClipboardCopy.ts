"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CopyStatus = "idle" | "copying" | "copied" | "failed";

export function useClipboardCopy(resetMs = 2000) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      setStatus("copying");
      try {
        await navigator.clipboard.writeText(text);
        setStatus("copied");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus("idle"), resetMs);
        return true;
      } catch {
        setStatus("failed");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus("idle"), resetMs);
        return false;
      }
    },
    [resetMs]
  );

  const label =
    status === "copying"
      ? "복사 중…"
      : status === "copied"
        ? "복사했어요 ✓"
        : null;

  return { status, copy, label };
}
