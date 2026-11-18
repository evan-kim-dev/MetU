import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { formatKRW } from "@/lib/shared/format";
import type { Trip } from "@/lib/trips/types";
import { computeTripDDay, formatTripDDayLabel } from "@/lib/trips/d-day";
import { DestinationImage } from "@/components/ui/DestinationImage";

interface ActiveTripCardProps {
  trip: Trip;
  priority?: boolean;
}

/** 진행 중인 여행 카드 — 이미지 위에 예산 요약 패널. */
export function ActiveTripCard({ trip, priority = false }: ActiveTripCardProps) {
  const remaining = trip.budget - trip.spent;
  const usedPercent =
    trip.budget > 0 ? Math.round((trip.spent / trip.budget) * 100) : 0;
  const dDay = computeTripDDay(trip.dateRange, trip.dDay);

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="relative block h-52 w-full overflow-hidden rounded-mu-xl transition-transform active:scale-[0.99]"
    >
      <DestinationImage
        destination={trip.destination}
        country={trip.country}
        storedUrl={trip.imageUrl}
        alt={`${trip.destination} 여행 이미지`}
        sizes="440px"
        priority={priority}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />

      <span className="absolute right-3 top-3 rounded-full border border-mu-line bg-mu-card px-3 py-1 text-xs font-extrabold text-mu-accent">
        {formatTripDDayLabel(dDay)}
      </span>

      <div className="absolute left-4 top-4 flex flex-col gap-1 text-white">
        <div className="flex items-center gap-1 text-xs font-semibold opacity-90">
          <MapPin className="h-3.5 w-3.5" strokeWidth={2.4} />
          {trip.country}
        </div>
        <h3 className="text-2xl font-extrabold drop-shadow-sm">
          {trip.destination}
        </h3>
        <div className="flex items-center gap-1 text-xs font-medium opacity-90">
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.2} />
          {trip.dateRange}
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-3 rounded-mu-xl border border-white/25 bg-black/55 p-3">
        <div className="flex items-center justify-between text-white">
          <span className="text-xs font-semibold opacity-90">남은 예산</span>
          <span className="mu-num text-sm font-extrabold">
            {formatKRW(remaining)}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/30">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] font-medium text-white/80">
          총 {formatKRW(trip.budget)} 중 {usedPercent}% 사용
        </p>
      </div>
    </Link>
  );
}