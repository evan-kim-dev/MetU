"use client";

import { useEffect, useState } from "react";
import type { FxTarget } from "@/lib/fx/currencies";

export type FxTargetState = FxTarget & { resolved: boolean };

const STORAGE_PREFIX = "metu:fx-target:";

function normalizeKey(
  country?: string | null,
  destination?: string | null
): string {
  const c = (country ?? "").trim().toLowerCase();
  const d = (destination ?? "").trim().toLowerCase();
  return `${c}|${d}`;
}

function readCache(key: string): FxTargetState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FxTargetState>;
    if (
      typeof parsed.code !== "string" ||
      typeof parsed.symbol !== "string" ||
      typeof parsed.label !== "string" ||
      typeof parsed.unit !== "number"
    ) {
      return null;
    }
    return {
      code: parsed.code,
      symbol: parsed.symbol,
      label: parsed.label,
      unit: parsed.unit,
      resolved: parsed.resolved !== false,
    };
  } catch {
    return null;
  }
}

function writeCache(key: string, value: FxTargetState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

function parseTarget(data: unknown): FxTargetState | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (
    typeof o.code !== "string" ||
    typeof o.symbol !== "string" ||
    typeof o.label !== "string" ||
    typeof o.unit !== "number"
  ) {
    return null;
  }
  return {
    code: o.code,
    symbol: o.symbol,
    label: o.label,
    unit: o.unit,
    resolved: o.resolved !== false,
  };
}

/**
 * 여행지 통화 해석. localStorage 캐시로 로딩 중 USD 깜빡임 방지.
 * enabled=false 이거나 country|destination 키가 비면 fetch 하지 않음.
 */
export function useFxTarget(
  country?: string | null,
  destination?: string | null,
  options?: { enabled?: boolean }
): {
  target: FxTargetState | null;
  loading: boolean;
  error: boolean;
} {
  const enabled = options?.enabled !== false;
  const key = normalizeKey(country, destination);
  const hasQuery = Boolean(
    (country ?? "").trim() || (destination ?? "").trim()
  );

  const [target, setTarget] = useState<FxTargetState | null>(() =>
    enabled && hasQuery ? readCache(key) : null
  );
  const [loading, setLoading] = useState(() => {
    if (!enabled || !hasQuery) return false;
    return readCache(key) == null;
  });
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !hasQuery) {
      setTarget(null);
      setLoading(false);
      setError(false);
      return;
    }

    const cached = readCache(key);
    if (cached) {
      setTarget(cached);
      setLoading(false);
    } else {
      setTarget(null);
      setLoading(true);
    }
    setError(false);

    const controller = new AbortController();
    const params = new URLSearchParams();
    if ((country ?? "").trim()) params.set("country", (country ?? "").trim());
    if ((destination ?? "").trim()) {
      params.set("destination", (destination ?? "").trim());
    }

    void (async () => {
      try {
        const res = await fetch(`/api/fx/target?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`fx-target-${res.status}`);
        const data: unknown = await res.json();
        const parsed = parseTarget(data);
        if (!parsed) throw new Error("fx-target-invalid");
        writeCache(key, parsed);
        if (!controller.signal.aborted) {
          setTarget(parsed);
          setError(false);
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        if (!controller.signal.aborted) {
          // 오프라인: 기존 localStorage 유지
          const fallback = readCache(key);
          if (fallback) setTarget(fallback);
          else setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [key, enabled, hasQuery, country, destination]);

  return { target, loading, error };
}
