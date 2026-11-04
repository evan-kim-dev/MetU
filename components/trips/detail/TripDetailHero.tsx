"use client";

import { CalendarDays, MapPin } from "lucide-react";
import { DestinationImage } from "@/components/ui/DestinationImage";
import { computeTripDDay, formatTripDDayLabel } from "@/lib/trips/d-day";
import type { Trip } from "@/lib/trips/types";

type Props = { trip: Trip };

export function TripDetailHero({ trip }: Props) {
  return (
    <div className="relative h-56 overflow-hidden rounded-2xl bg-surface-soft shadow-md">
      <DestinationImage
        destination={trip.destination}
        country={trip.country}
        storedUrl={trip.imageUrl}
        alt={`${trip.destination} 여행`}
        sizes="440px"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4 text-surface-white">
        <div className="flex items-center gap-1 text-xs font-semibold opacity-90">
          <MapPin className="h-3.5 w-3.5" />
          {trip.country}
        </div>
        <h2 className="mt-1 text-3xl font-extrabold">{trip.destination}</h2>
        <div className="mt-1 flex items-center gap-1 text-sm opacity-90">
          <CalendarDays className="h-4 w-4" />
          {trip.dateRange}
        </div>
      </div>
      <span className="absolute right-3 top-3 rounded-full bg-surface-white/90 px-3 py-1 text-xs font-extrabold text-brand-strong">
        {trip.status === "upcoming"
          ? formatTripDDayLabel(computeTripDDay(trip.dateRange, trip.dDay))
          : trip.status === "ongoing"
            ? "진행 중"
            : "완료"}
      </span>
    </div>
  );
}
