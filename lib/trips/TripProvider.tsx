"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { STORAGE_KEYS } from "@/lib/constants";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { loadTrips, saveTrips, updateTripInList } from "./storage";
import {
  deleteTripFromSupabase,
  fetchTripsFromSupabase,
  insertTripToSupabase,
  updateTripInSupabase,
  upsertTripsToSupabase,
} from "./supabase";
import type { Trip, TripUpdate } from "./types";

interface TripContextValue {
  trips: Trip[];
  isReady: boolean;
  getTrip: (id: string) => Trip | undefined;
  updateTrip: (id: string, update: TripUpdate) => void;
  addTrip: (trip: Trip) => Promise<Trip>;
  removeTrip: (id: string) => void;
  activeTrips: Trip[];
}

const TripContext = createContext<TripContextValue | null>(null);

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
          setTrips(loadTrips());
          setIsReady(true);
        }
        return;
      }

      let remote = await fetchTripsFromSupabase(supabase, userId);

      if (remote.length === 0 && hasPersistedLocalTrips()) {
        const local = loadTrips();
        remote = await upsertTripsToSupabase(supabase, userId, local);
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEYS.trips);
        }
      }

      if (!cancelled) {
        setTrips(remote.length > 0 ? remote : loadTrips());
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

  const updateTrip = useCallback(
    (id: string, update: TripUpdate) => {
      setTrips((prev) => {
        const next = updateTripInList(prev, id, update);
        const updated = next.find((trip) => trip.id === id);
        if (useDb && userId && updated) {
          const supabase = getBrowserSupabase();
          if (supabase) {
            void updateTripInSupabase(supabase, userId, id, update);
          }
        }
        return next;
      });
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

  const activeTrips = useMemo(
    () => trips.filter((trip) => trip.status !== "completed"),
    [trips]
  );

  const value = useMemo(
    () => ({
      trips,
      isReady,
      getTrip,
      updateTrip,
      addTrip,
      removeTrip,
      activeTrips,
    }),
    [trips, isReady, getTrip, updateTrip, addTrip, removeTrip, activeTrips]
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
