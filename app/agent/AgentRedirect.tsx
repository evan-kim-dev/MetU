"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { STORAGE_KEYS } from "@/lib/constants";
import { useTrips } from "@/lib/trips/TripProvider";

/**
 * EDR Phase 3: /agent 허브 흡수.
 * 북마크·딥링크는 유지하되 마지막 여행 요약 또는 /trips 로 soft 리다이렉트.
 */
export function AgentRedirect() {
  const router = useRouter();
  const { trips, isReady } = useTrips();

  useEffect(() => {
    if (!isReady) return;
    let target = "/trips";
    try {
      const stored = window.localStorage.getItem(
        STORAGE_KEYS.ledgerSelectedTrip
      );
      if (stored && trips.some((t) => t.id === stored)) {
        target = `/trips/${stored}`;
      } else if (trips.length === 1 && trips[0]) {
        target = `/trips/${trips[0].id}`;
      }
    } catch {
      if (trips.length === 1 && trips[0]) {
        target = `/trips/${trips[0].id}`;
      }
    }
    router.replace(target);
  }, [isReady, trips, router]);

  return (
    <MobileShell title="여행으로 이동" showBottomNav>
      <div
        className="flex flex-col gap-3 px-5 pt-8"
        aria-busy="true"
        aria-label="이동 중"
      >
        <div className="h-8 w-40 animate-pulse rounded-mu-md bg-mu-sunken" />
        <p className="text-mu-body text-mu-fg-2">
          가계부 허브는 여행 화면으로 옮겼어요. 잠시만요.
        </p>
      </div>
    </MobileShell>
  );
}
