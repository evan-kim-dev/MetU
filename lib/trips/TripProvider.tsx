"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadTrips, saveTrips, updateTripInList, ensureUniqueTripIds } from "./storage";
import type { Trip, TripUpdate } from "./types";

interface TripContextValue {
  trips: Trip[];
  isReady: boolean;
  getTrip: (id: string) => Trip | undefined;
  updateTrip: (id: string, update: TripUpdate) => void;
  addTrip: (trip: Trip) => void;
  removeTrip: (id: string) => void;
  activeTrips: Trip[];
}

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setTrips(loadTrips());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    saveTrips(trips);
  }, [trips, isReady]);

  const getTrip = useCallback(
    (id: string) => trips.find((trip) => trip.id === id),
    [trips]
  );

  const updateTrip = useCallback((id: string, update: TripUpdate) => {
    setTrips((prev) => updateTripInList(prev, id, update));
  }, []);

  const addTrip = useCallback((trip: Trip) => {
    setTrips((prev) => {
      const withNew = [trip, ...prev];
      return ensureUniqueTripIds(withNew);
    });
  }, []);

  const removeTrip = useCallback((id: string) => {
    setTrips((prev) => prev.filter((trip) => trip.id !== id));
  }, []);

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
