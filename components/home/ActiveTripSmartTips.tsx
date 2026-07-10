"use client";

import { useEffect, useState } from "react";
import { SmartTips } from "@/components/home/SmartTips";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useTrips } from "@/lib/trips/TripProvider";
import { buildTipsForTrip } from "@/lib/tips/buildTipsForTrip";
import type { SmartTip } from "@/lib/mock/home";

export function ActiveTripSmartTips() {
  const { activeTrips, isReady } = useTrips();
  const primaryTrip = activeTrips[0] ?? null;
  const [tips, setTips] = useState<SmartTip[]>(() =>
    buildTipsForTrip(primaryTrip)
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isReady) return;

    const localTips = buildTipsForTrip(primaryTrip);
    setTips(localTips);

    const controller = new AbortController();
    setLoading(true);

    fetch("/api/trip-tips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trip: primaryTrip }),
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("trip-tips-failed");
        return (await res.json()) as { tips?: SmartTip[] };
      })
      .then((data) => {
        if (Array.isArray(data.tips) && data.tips.length > 0) {
          setTips(data.tips);
        }
      })
      .catch((error) => {
        if ((error as Error)?.name === "AbortError") return;
        setTips(localTips);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [
    isReady,
    primaryTrip?.id,
    primaryTrip?.destination,
    primaryTrip?.country,
    primaryTrip?.budget,
    primaryTrip?.spent,
    primaryTrip?.dDay,
    primaryTrip?.people,
    primaryTrip?.dateRange,
    primaryTrip?.styles?.join(","),
  ]);

  if (!isReady) {
    return (
      <div className="flex flex-col gap-3">
        <SectionHeader title="AI Tip" ai />
        <div className="flex gap-3 overflow-hidden">
          <div className="h-28 w-60 shrink-0 animate-pulse rounded-2xl bg-surface-soft" />
          <div className="h-28 w-60 shrink-0 animate-pulse rounded-2xl bg-surface-soft" />
        </div>
      </div>
    );
  }

  const title = primaryTrip
    ? `AI Tip · ${primaryTrip.destination}`
    : "AI Tip · 여행 준비";

  return (
    <div className="relative">
      <SmartTips tips={tips} title={title} />
      {loading ? (
        <span className="absolute right-5 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
      ) : null}
    </div>
  );
}
