import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin } from "lucide-react";
import { formatKRW } from "@/lib/mock/home";
import type { Trip } from "@/lib/trips/types";

interface ActiveTripCardProps {
  trip: Trip;
  priority?: boolean;
}

/**
 * 진행 중인 여행 카드.
 * 배경 이미지 위에 Glassmorphism(반투명 + blur) 정보 패널을 올린다.
 */
export function ActiveTripCard({ trip, priority = false }: ActiveTripCardProps) {
  const remaining = trip.budget - trip.spent;
  const usedPercent = Math.round((trip.spent / trip.budget) * 100);

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="relative block h-52 w-full overflow-hidden rounded-xl2 shadow-soft transition-transform active:scale-[0.99]"
    >
      <Image
        src={trip.imageUrl}
        alt={`${trip.destination} 여행 이미지`}
        fill
        sizes="440px"
        className="object-cover"
        priority={priority}
      />
      {/* 가독성용 어둠 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />

      {/* D-Day 뱃지 */}
      <span className="absolute right-3 top-3 rounded-full bg-surface-white/85 px-3 py-1 text-xs font-extrabold text-brand-strong backdrop-blur-md">
        D-{trip.dDay}
      </span>

      {/* 상단 목적지 */}
      <div className="absolute left-4 top-4 flex flex-col gap-1 text-surface-white">
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

      {/* 하단 Glassmorphism 예산 패널 */}
      <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/30 bg-white/20 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between text-surface-white">
          <span className="text-xs font-semibold opacity-90">남은 예산</span>
          <span className="text-sm font-extrabold">{formatKRW(remaining)}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/30">
          <div
            className="h-full rounded-full bg-surface-white"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] font-medium text-surface-white/80">
          총 {formatKRW(trip.budget)} 중 {usedPercent}% 사용
        </p>
      </div>
    </Link>
  );
}
