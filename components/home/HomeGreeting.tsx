"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { DEFAULTS } from "@/lib/constants";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { useTrips } from "@/lib/trips/TripProvider";
import {
  FALLBACK_RATES,
  formatFxRate,
  resolveFxTarget,
  type FxTarget,
} from "@/lib/fx/currencies";

const DEFAULT_EMPTY_FX: FxTarget = {
  code: "USD",
  symbol: "$",
  unit: 1,
  label: "달러",
};

const REFRESH_MS = DEFAULTS.fxRefreshMs;

export function HomeGreeting() {
  const { profile } = useProfile();
  const { activeTrips, isReady } = useTrips();
  const primaryTrip = activeTrips[0];
  const hasTrip = Boolean(isReady && primaryTrip);

  const fxTarget = useMemo(() => {
    if (!hasTrip || !primaryTrip) return DEFAULT_EMPTY_FX;
    return resolveFxTarget(primaryTrip.country, primaryTrip.destination);
  }, [hasTrip, primaryTrip]);

  const [krwPerUnit, setKrwPerUnit] = useState(
    () => FALLBACK_RATES[fxTarget.code]
  );
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadFx = useCallback(
    async (code: typeof fxTarget.code, signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/fx?code=${code}&_=${Date.now()}`, {
          cache: "no-store",
          signal,
        });
        if (!res.ok) throw new Error("fx-failed");
        const data = (await res.json()) as {
          krw: number;
          source?: string;
          updatedAt?: string;
        };
        if (!Number.isFinite(data.krw) || data.krw <= 0) return;

        setKrwPerUnit(data.krw);
        setIsLive(data.source === "live");
        setUpdatedAt(data.updatedAt ? new Date(data.updatedAt) : new Date());
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        /* 폴백 유지 */
      }
    },
    []
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadFx(fxTarget.code);
    } finally {
      setIsRefreshing(false);
    }
  }, [fxTarget.code, isRefreshing, loadFx]);

  useEffect(() => {
    setKrwPerUnit(FALLBACK_RATES[fxTarget.code]);
    setIsLive(false);

    const controller = new AbortController();
    void loadFx(fxTarget.code, controller.signal);

    const timer = window.setInterval(() => {
      void loadFx(fxTarget.code);
    }, REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [fxTarget.code, loadFx]);

  const rateLabel = formatFxRate(fxTarget, krwPerUnit);

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="min-w-0 truncate text-sm font-medium text-ink-caption">
        안녕하세요, {profile.name}님 👋
      </p>
      <div
        className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-line-soft bg-surface-white px-2.5 py-1.5 shadow-sm"
        title={
          hasTrip && primaryTrip
            ? `${primaryTrip.destination} 기준 실시간 ${fxTarget.label} 환율 · 1분마다 갱신${
                updatedAt ? ` · ${updatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}` : ""
              }`
            : "기본 참고 환율 (USD) · 1분마다 갱신"
        }
      >
        <p className="whitespace-nowrap text-[11px] font-extrabold leading-none tracking-tight text-ink-heading">
          <span className="font-medium text-ink-caption">
            {isLive ? "실시간 " : "환율 "}
          </span>
          {rateLabel}
        </p>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing}
          aria-label="환율 새로고침"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-caption transition-colors active:bg-surface-soft disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            strokeWidth={2.4}
          />
        </button>
      </div>
    </div>
  );
}
