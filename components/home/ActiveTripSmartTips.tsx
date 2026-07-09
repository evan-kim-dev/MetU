"use client";

import { SmartTips } from "@/components/home/SmartTips";
import { useTrips } from "@/lib/trips/TripProvider";
import { buildTipsForTrip } from "@/lib/tips/buildTipsForTrip";

export function ActiveTripSmartTips() {
  const { activeTrips, isReady } = useTrips();
  const primaryTrip = activeTrips[0] ?? null;
  const tips = buildTipsForTrip(primaryTrip);

  if (!isReady) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-7 w-20 animate-pulse rounded bg-surface-soft" />
        <div className="flex gap-3 overflow-hidden">
          <div className="h-28 w-56 shrink-0 animate-pulse rounded-2xl bg-surface-soft" />
          <div className="h-28 w-56 shrink-0 animate-pulse rounded-2xl bg-surface-soft" />
        </div>
      </div>
    );
  }

  const title = primaryTrip
    ? `AI Tip · ${primaryTrip.destination}`
    : "AI Tip · 여행 준비";

  return <SmartTips tips={tips} title={title} />;
}
