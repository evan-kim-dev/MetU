"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { FxAttribution } from "@/components/fx/FxAttribution";
import { DEFAULTS } from "@/lib/constants";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { useTrips } from "@/lib/trips/TripProvider";
import {
  formatFxRate,
  resolveFxTarget,
  type FxTarget,
} from "@/lib/fx/currencies";
import {
  useEasterEggToast,
  useSecretTap,
} from "@/components/ui/EasterEggToast";

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
  const { summonBuddy } = useEasterEggToast();
  const onGreetingTap = useSecretTap({
    tapsRequired: 7,
    windowMs: 3000,
    onceKey: "metu-egg-greeting",
    onTrigger: () => {
      summonBuddy("손가락으로 일곱 번? 뭐야 너. 나 MetU 버디야.");
    },
  });

  const fxTarget = useMemo(() => {
    if (!hasTrip || !primaryTrip) return DEFAULT_EMPTY_FX;
    return resolveFxTarget(primaryTrip.country, primaryTrip.destination);
  }, [hasTrip, primaryTrip]);

  const [krwPerUnit, setKrwPerUnit] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isLastKnown, setIsLastKnown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadFx = useCallback(
    async (code: string, signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/fx?code=${code}&_=${Date.now()}`, {
          cache: "no-store",
          signal,
        });
        if (!res.ok) throw new Error("fx-failed");
        const data = (await res.json()) as {
          krw: number;
          source?: string;
          rateDate?: string;
          updatedAt?: string;
        };
        if (!Number.isFinite(data.krw) || data.krw <= 0) return;

        setKrwPerUnit(data.krw);
        setIsLive(data.source === "live" || data.source === "cached");
        setIsLastKnown(data.source === "last-known");
        setRateDate(data.rateDate ?? null);
        setUpdatedAt(data.updatedAt ? new Date(data.updatedAt) : new Date());
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        /* 상수 폴백 없음 — 이전 값 유지 또는 미표시 */
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
    setKrwPerUnit(null);
    setIsLive(false);
    setIsLastKnown(false);
    setRateDate(null);

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

  const rateLabel =
    krwPerUnit != null ? formatFxRate(fxTarget, krwPerUnit) : "환율 불러오는 중…";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onGreetingTap}
          className="min-w-0 truncate text-left text-sm font-medium text-ink-caption"
        >
          안녕하세요, {profile.name}님 👋
        </button>
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-line-soft bg-surface-white px-2.5 py-1.5 shadow-sm"
          title={
            hasTrip && primaryTrip
              ? `${primaryTrip.destination} 기준 실시간 ${fxTarget.label} 환율 · 1분마다 갱신${
                  updatedAt
                    ? ` · ${updatedAt.toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""
                }`
              : "기본 참고 환율 (USD) · 1분마다 갱신"
          }
        >
          <p className="whitespace-nowrap text-[11px] font-extrabold leading-none tracking-tight text-ink-heading">
            <span className="font-medium text-ink-caption">
              {isLive ? "실시간 " : isLastKnown ? "마지막 " : "환율 "}
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
      {isLastKnown && rateDate ? (
        <p className="text-right text-[10px] text-ink-muted">
          마지막 업데이트 {rateDate}
        </p>
      ) : null}
      <FxAttribution className="text-right text-[10px] leading-snug text-ink-muted" />
    </div>
  );
}
