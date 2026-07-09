import { INITIAL_TRIPS } from "./data";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Trip, TripUpdate } from "./types";

const STORAGE_KEY = STORAGE_KEYS.trips;

/** 중복·빈 ID를 고유 값으로 교정 */
export function ensureUniqueTripIds(trips: Trip[]): Trip[] {
  const seen = new Set<string>();
  let changed = false;

  const next = trips.map((trip, index) => {
    const needsNewId =
      !trip.id || seen.has(trip.id);

    if (!needsNewId) {
      seen.add(trip.id);
      return trip;
    }

    changed = true;
    const uniqueId = `trip-${Date.now()}-${index}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    seen.add(uniqueId);
    return { ...trip, id: uniqueId };
  });

  return changed ? next : trips;
}

export function loadTrips(): Trip[] {
  if (typeof window === "undefined") return INITIAL_TRIPS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_TRIPS;
    const parsed = JSON.parse(raw) as Trip[];
    if (!parsed.length) return INITIAL_TRIPS;
    return ensureUniqueTripIds(parsed);
  } catch {
    return INITIAL_TRIPS;
  }
}

export function saveTrips(trips: Trip[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export function getTripById(trips: Trip[], id: string): Trip | undefined {
  return trips.find((trip) => trip.id === id);
}

export function updateTripInList(
  trips: Trip[],
  id: string,
  update: TripUpdate
): Trip[] {
  return trips.map((trip) => {
    if (trip.id !== id) return trip;

    const nextSpent =
      update.expenses?.reduce((sum, item) => sum + item.amount, 0) ??
      update.spent ??
      trip.spent;

    return {
      ...trip,
      ...update,
      spent: nextSpent,
    };
  });
}

export function getActiveTrips(trips: Trip[]): Trip[] {
  return trips.filter((trip) => trip.status !== "completed");
}
