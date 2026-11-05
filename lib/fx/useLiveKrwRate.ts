"use client";

import { useEffect, useState } from "react";

export type LiveKrwRate = {
  code: string;
  krw: number;
  source?: string;
};

/**
 * `/api/fx?code=` 라이브(또는 캐시) 환율. 실패해도 앱을 깨지 않아요.
 */
export function useLiveKrwRate(
  code: string | null | undefined,
  options?: { enabled?: boolean }
): {
  rate: LiveKrwRate | null;
  loading: boolean;
  error: boolean;
} {
  const enabled = options?.enabled !== false;
  const normalized = (code ?? "").trim().toUpperCase() || null;

  const [rate, setRate] = useState<LiveKrwRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !normalized) {
      setRate(null);
      setLoading(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);

    void (async () => {
      try {
        const res = await fetch(
          `/api/fx?code=${encodeURIComponent(normalized)}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!res.ok) throw new Error(`fx-${res.status}`);
        const data = (await res.json()) as {
          code?: string;
          krw?: number;
          source?: string;
        };
        if (!(typeof data.krw === "number" && data.krw > 0)) {
          throw new Error("fx-invalid");
        }
        if (!controller.signal.aborted) {
          setRate({
            code: (data.code ?? normalized).toUpperCase(),
            krw: data.krw,
            source: data.source,
          });
          setError(false);
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setRate(null);
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [enabled, normalized]);

  return { rate, loading, error };
}
