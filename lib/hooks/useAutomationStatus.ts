"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetchJson } from "@/lib/api/fetch-json";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { UserFacingError } from "@/lib/errors/user-message";
import {
  toAutomationUiState,
  type AutomationUiState,
} from "@/lib/onboarding/automation-ui-state";

export type AutomationStatusEvent = {
  id: string;
  status: string;
  createdAt: string;
  source: string;
  tripId: string | null;
  textPreview: string;
  error: string | null;
  reason: string | null;
  isTest?: boolean;
  preview?: {
    amount: number | null;
    currency: string | null;
    merchant: string | null;
    confidence: number;
    kind: string;
  } | null;
};

export type AutomationStatusData = {
  status: "pending" | "partial" | "done" | "skipped";
  platform: string | null;
  selectedApps: string[];
  lastNotificationAt: string | null;
  lastDeviceTestAt: string | null;
  /** 실제 카드 알림(sim·MTU-TEST 제외) 최신 도착 시각 */
  lastRealEventAt?: string | null;
  /** 서버 시각(ISO). 클라이언트 시계 오차 보정용 */
  serverNow?: string;
  lastServerTestAt: string | null;
  lastDroppedApp: string | null;
  state: string;
  hasActiveToken: boolean;
  activeTrip: boolean;
  hasRecentEvent?: boolean;
  recentEvents: AutomationStatusEvent[];
  unassignedCount: number;
};

type CacheEntry = {
  data: AutomationStatusData;
  at: number;
};

const cacheByKey = new Map<string, CacheEntry>();
const inflightByKey = new Map<string, Promise<AutomationStatusData | null>>();

const HOME_LITE_TTL_MS = 60_000;

type Options = {
  enabled?: boolean;
  lite?: boolean;
  intervalMs?: number;
  cacheTtlMs?: number;
};

export function useAutomationStatus(opts: Options = {}) {
  const {
    enabled = true,
    lite = false,
    intervalMs,
    cacheTtlMs = lite ? HOME_LITE_TTL_MS : 0,
  } = opts;
  const { isReady, isLoggedIn, provider } = useAuth();
  const [data, setData] = useState<AutomationStatusData | null>(null);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [loading, setLoading] = useState(false);
  const [rateSlow, setRateSlow] = useState(false);
  const delayRef = useRef(intervalMs ?? 0);
  const visibleRef = useRef(true);

  const isGuest = provider === "guest";
  const canFetch = enabled && isReady && isLoggedIn && !isGuest;
  const cacheKey = lite ? "lite" : "full";

  const fetchOnce = useCallback(async (): Promise<AutomationStatusData | null> => {
    if (!canFetch) return null;

    const cached = cacheByKey.get(cacheKey);
    if (cached && cacheTtlMs > 0 && Date.now() - cached.at < cacheTtlMs) {
      return cached.data;
    }

    const existing = inflightByKey.get(cacheKey);
    if (existing) return existing;

    const url = lite
      ? "/api/agent/automation-status?lite=1"
      : "/api/agent/automation-status";

    const promise = (async () => {
      const res = await apiFetchJson<AutomationStatusData>(url, undefined, {
        source: "api",
      });
      if (!res.ok) {
        if (res.status === 429) {
          const wait = (res.error.retryAfterSec ?? 20) * 1000;
          delayRef.current = Math.max(delayRef.current, wait);
          setRateSlow(true);
          return null;
        }
        setError(res.error);
        return null;
      }
      setRateSlow(false);
      setError(null);
      cacheByKey.set(cacheKey, { data: res.data, at: Date.now() });
      return res.data;
    })().finally(() => {
      inflightByKey.delete(cacheKey);
    });

    inflightByKey.set(cacheKey, promise);
    return promise;
  }, [canFetch, cacheKey, cacheTtlMs, lite]);

  const refresh = useCallback(async () => {
    if (!canFetch) return;
    setLoading(true);
    try {
      cacheByKey.delete(cacheKey);
      const next = await fetchOnce();
      if (next) setData(next);
    } finally {
      setLoading(false);
    }
  }, [canFetch, cacheKey, fetchOnce]);

  useEffect(() => {
    if (!canFetch) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const next = await fetchOnce();
      if (!cancelled && next) setData(next);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canFetch, fetchOnce]);

  useEffect(() => {
    if (!canFetch || !intervalMs || intervalMs <= 0) return;

    delayRef.current = intervalMs;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || !visibleRef.current) return;
      const next = await fetchOnce();
      if (!cancelled && next) setData(next);
      delayRef.current = Math.max(intervalMs, delayRef.current * 0.9);
      schedule();
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (!visibleRef.current) return;
      const delay = Math.max(delayRef.current, 5000);
      timer = setTimeout(() => {
        void tick();
      }, delay);
    };

    const onVisibility = () => {
      visibleRef.current = document.visibilityState === "visible";
      if (visibleRef.current) {
        void tick();
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    visibleRef.current = document.visibilityState === "visible";
    if (visibleRef.current) schedule();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, [canFetch, fetchOnce, intervalMs]);

  const uiState: AutomationUiState | null = data
    ? toAutomationUiState({
        status: data.status,
        hasActiveToken: data.hasActiveToken,
        hasRecentEvent:
          typeof data.hasRecentEvent === "boolean"
            ? data.hasRecentEvent
            : data.recentEvents.some((e) => e.source !== "sim"),
        lastNotificationAt: data.lastNotificationAt,
      })
    : null;

  return {
    data,
    error,
    loading,
    refresh,
    uiState,
    rateSlow,
  };
}
