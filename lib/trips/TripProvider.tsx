"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { STORAGE_KEYS } from "@/lib/constants";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { loadTrips, saveTrips, updateTripInList } from "./storage";
import {
  deleteTripFromSupabase,
  fetchTripByIdFromSupabase,
  fetchTripsFromSupabase,
  insertTripToSupabase,
  isTripDetailHydrated,
  tripDateColumns,
  updateTripInSupabase,
  upsertTripsToSupabase,
} from "./supabase";
import type { Trip, TripUpdate } from "./types";

interface TripContextValue {
  trips: Trip[];
  isReady: boolean;
  getTrip: (id: string) => Trip | undefined;
  /** Load full trip JSON (schedule/expenses) when list payload is light. */
  ensureTripDetail: (id: string) => Promise<Trip | undefined>;
  updateTrip: (id: string, update: TripUpdate) => void;
  addTrip: (trip: Trip) => Promise<Trip>;
  removeTrip: (id: string) => void;
  activeTrips: Trip[];
  /**
   * 초대로 합류한 직후 호출: 내 여행 목록을 다시 불러오고, 합류한 여행의 기간에 맞는
   * 미배정 알림을 재매칭해요. 실패해도 화면 흐름은 막지 않아요.
   */
  afterJoinTrip: (tripId: string) => Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);

/**
 * 미배정 알림 재부착 요청. 실패해도 화면 흐름은 막지 않는다(콘솔만).
 * 저장된 start/end 를 함께 보내 서버 RPC 가 컬럼이 비어 있어도 창을 계산할 수 있게 한다.
 */
async function requestAttachUnassigned(
  trip: Pick<Trip, "id" | "startDate" | "endDate">
): Promise<void> {
  try {
    const res = await fetch("/api/agent/attach-unassigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: trip.id,
        ...(trip.startDate ? { startDate: trip.startDate } : {}),
        ...(trip.startDate && trip.endDate ? { endDate: trip.endDate } : {}),
      }),
    });
    if (!res.ok) {
      console.warn("[TripProvider] attach-unassigned", res.status);
    }
  } catch (err) {
    console.warn(
      "[TripProvider] attach-unassigned",
      err instanceof Error ? err.message : err
    );
  }
}

function hasPersistedLocalTrips(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(STORAGE_KEYS.trips));
}

export function TripProvider({ children }: { children: React.ReactNode }) {
  const { user, provider, isReady: isAuthReady } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isReady, setIsReady] = useState(false);

  const userId = user?.id ?? null;
  const useDb = Boolean(userId) && provider !== "guest";

  // updateTrip/removeTrip 의 콜백 신원을 유지하면서 소유 여부를 확인하기 위한 최신 목록.
  const tripsRef = useRef<Trip[]>([]);
  useEffect(() => {
    tripsRef.current = trips;
  }, [trips]);

  useEffect(() => {
    if (!isAuthReady) return;

    let cancelled = false;

    async function load() {
      if (!useDb || !userId) {
        if (!cancelled) {
          setTrips(loadTrips());
          setIsReady(true);
        }
        return;
      }

      const supabase = getBrowserSupabase();
      if (!supabase) {
        if (!cancelled) {
          setTrips([]);
          setIsReady(true);
        }
        return;
      }

      let remote = await fetchTripsFromSupabase(supabase, userId);

      // 과거에 시드된 데모 여행이 DB에 남아 있으면 제거
      const demoRemote = remote.filter(
        (trip) => trip.id === "trip-london" || trip.id === "trip-osaka"
      );
      if (demoRemote.length > 0) {
        await Promise.all(
          demoRemote.map((trip) =>
            deleteTripFromSupabase(supabase, userId, trip.id)
          )
        );
        remote = remote.filter(
          (trip) => trip.id !== "trip-london" && trip.id !== "trip-osaka"
        );
      }

      // 게스트/로컬에서 만든 실제 여행만 계정으로 이전 (데모 시드는 loadTrips에서 제거됨)
      if (remote.length === 0 && hasPersistedLocalTrips()) {
        const local = loadTrips();
        if (local.length > 0) {
          remote = await upsertTripsToSupabase(supabase, userId, local);
        }
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEYS.trips);
        }
      }

      if (!cancelled) {
        setTrips(remote);
        setIsReady(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, useDb, userId]);

  useEffect(() => {
    if (!isReady || useDb) return;
    saveTrips(trips);
  }, [trips, isReady, useDb]);

  const getTrip = useCallback(
    (id: string) => trips.find((trip) => trip.id === id),
    [trips]
  );

  const ensureTripDetail = useCallback(
    async (id: string): Promise<Trip | undefined> => {
      const current = trips.find((trip) => trip.id === id);
      if (!current) return undefined;
      if (!useDb || !userId) return current;
      if (isTripDetailHydrated(current)) return current;

      const supabase = getBrowserSupabase();
      if (!supabase) return current;

      const full = await fetchTripByIdFromSupabase(supabase, userId, id);
      if (!full) return current;

      setTrips((prev) =>
        prev.map((trip) => (trip.id === id ? full : trip))
      );
      return full;
    },
    [trips, useDb, userId]
  );

  const updateTrip = useCallback(
    (id: string, update: TripUpdate) => {
      // 공유받은 여행은 읽기 전용이에요 (DB 도 소유자만 수정할 수 있어요).
      if (tripsRef.current.find((trip) => trip.id === id)?.isOwner === false) {
        console.warn("[TripProvider] 공유받은 여행은 수정할 수 없어요", id);
        return;
      }
      // 날짜 라벨이 바뀌면 확정 날짜도 같이 계산해 화면 상태와 DB 컬럼을 맞춘다.
      let normalized: TripUpdate = update;
      if (update.dateRange !== undefined && update.startDate === undefined) {
        const cols = tripDateColumns({ dateRange: update.dateRange });
        normalized = {
          ...update,
          startDate: cols.start_date,
          endDate: cols.end_date,
        };
      }
      const toApply = normalized;

      setTrips((prev) => updateTripInList(prev, id, toApply));

      if (!useDb || !userId) return;
      const supabase = getBrowserSupabase();
      if (!supabase) return;

      // 저장이 끝난 뒤에만 미배정 알림을 붙인다 (update 와 attach 가 경합하면
      // attach 가 낡은 날짜를 보고 0건으로 끝난다).
      void (async () => {
        const saved = await updateTripInSupabase(supabase, userId, id, toApply);
        if (!saved) {
          console.warn("[TripProvider] 여행 저장에 실패했어요", id);
          return;
        }
        if (
          toApply.dateRange !== undefined ||
          toApply.startDate !== undefined ||
          toApply.endDate !== undefined
        ) {
          await requestAttachUnassigned(saved);
        }
      })();
    },
    [useDb, userId]
  );

  const addTrip = useCallback(
    async (trip: Trip): Promise<Trip> => {
      if (useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          const saved = await insertTripToSupabase(supabase, userId, trip);
          if (saved) {
            setTrips((prev) => [saved, ...prev]);
            // 기간이 맞는 미할당 이벤트만 이 여행에 붙인다(토큰은 사용자 단위 유지).
            void requestAttachUnassigned(saved);
            return saved;
          }
        }
      }

      setTrips((prev) => [trip, ...prev]);
      return trip;
    },
    [useDb, userId]
  );

  const removeTrip = useCallback(
    (id: string) => {
      if (tripsRef.current.find((trip) => trip.id === id)?.isOwner === false) {
        console.warn("[TripProvider] 공유받은 여행은 삭제할 수 없어요", id);
        return;
      }
      setTrips((prev) => prev.filter((trip) => trip.id !== id));
      if (useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void deleteTripFromSupabase(supabase, userId, id);
        }
      }
    },
    [useDb, userId]
  );

  const afterJoinTrip = useCallback(
    async (tripId: string): Promise<void> => {
      if (!useDb || !userId) return;
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const remote = await fetchTripsFromSupabase(supabase, userId);
      // 조회가 실패해 빈 배열이 오면 화면의 기존 목록을 지우지 않는다.
      if (remote.length > 0) setTrips(remote);
      const joined = remote.find((trip) => trip.id === tripId);
      await requestAttachUnassigned(
        joined ?? { id: tripId, startDate: null, endDate: null }
      );
    },
    [useDb, userId]
  );

  const activeTrips = useMemo(
    () => trips.filter((trip) => trip.status !== "completed"),
    [trips]
  );

  const value = useMemo(
    () => ({
      trips,
      isReady,
      getTrip,
      ensureTripDetail,
      updateTrip,
      addTrip,
      removeTrip,
      activeTrips,
      afterJoinTrip,
    }),
    [
      trips,
      isReady,
      getTrip,
      ensureTripDetail,
      updateTrip,
      addTrip,
      removeTrip,
      activeTrips,
      afterJoinTrip,
    ]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrips() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error("useTrips must be used within TripProvider");
  }
  return context;
}
