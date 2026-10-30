import { resolveDestinationImage } from "@/lib/trips/destination-image";
import { computeTripDDay } from "@/lib/trips/d-day";
import type { Trip } from "@/lib/trips/types";
import { seoulDateIso } from "@/lib/onboarding/trip-window";

function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 1;
  return Math.max(1, Math.min(30, Math.floor(days)));
}

export function buildQuickTrip(input: {
  destination: string;
  startIso: string;
  days: number;
  now?: Date;
}): Trip {
  const destination = input.destination.trim();
  const days = clampDays(input.days);
  const nights = days - 1;
  const startIso = input.startIso.trim();
  const dateRange = `${startIso} · ${nights}박 ${days}일`;
  const now = input.now ?? new Date();
  const todaySeoul = seoulDateIso(now);
  const status = startIso <= todaySeoul ? "ongoing" : "upcoming";

  return {
    id: crypto.randomUUID(),
    destination,
    country: "",
    origin: "서울",
    dateRange,
    dDay: computeTripDDay(dateRange, 0, todaySeoul),
    budget: 0,
    spent: 0,
    people: 1,
    styles: [],
    imageUrl: resolveDestinationImage(destination, ""),
    expenses: [],
    status,
  };
}
