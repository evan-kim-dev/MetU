"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Trip } from "@/lib/trips/types";

/**
 * 기본으로 보여 줄 여행: 진행 중(ongoing) > 임박(upcoming, 출발일이 가까운 순) > 최근 생성.
 * 목록은 최근 생성이 먼저 오므로(fetchTripsFromSupabase) 마지막 폴백은 첫 번째 여행이에요.
 * 진행 중·예정 여행이 하나도 없으면(모두 완료) 전체 목록에서 고른다.
 */
export function pickDefaultTrip(trips: Trip[]): Trip | null {
  if (trips.length === 0) return null;
  const active = trips.filter((t) => t.status !== "completed");
  const pool = active.length > 0 ? active : trips;

  const ongoing = pool.find((t) => t.status === "ongoing");
  if (ongoing) return ongoing;

  const upcoming = pool.filter((t) => t.status === "upcoming");
  if (upcoming.length > 0) {
    const dated = upcoming
      .filter((t) => Boolean(t.startDate))
      .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
    return dated[0] ?? upcoming[0]!;
  }
  return pool[0] ?? null;
}

function readStoredTripId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.ledgerSelectedTrip);
  } catch (err) {
    console.warn(
      "[useSelectedTrip] read",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** 가계부 탭에서 보고 있는 여행. 마지막 선택을 localStorage 에 저장·복원한다. */
export function useSelectedTrip(trips: Trip[], isReady: boolean) {
  const [storedId, setStoredId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setStoredId(readStoredTripId());
    setRestored(true);
  }, []);

  const selectedTrip = useMemo(() => {
    if (!isReady || !restored) return null;
    const stored = storedId ? trips.find((t) => t.id === storedId) : undefined;
    return stored ?? pickDefaultTrip(trips);
  }, [isReady, restored, storedId, trips]);

  const select = useCallback((id: string) => {
    setStoredId(id);
    try {
      window.localStorage.setItem(STORAGE_KEYS.ledgerSelectedTrip, id);
    } catch (err) {
      console.warn(
        "[useSelectedTrip] write",
        err instanceof Error ? err.message : err
      );
    }
  }, []);

  return { selectedTrip, select, ready: isReady && restored };
}
