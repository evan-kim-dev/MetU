"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ActiveTripCard } from "@/components/home/ActiveTripCard";
import { useTrips } from "@/lib/trips/TripProvider";

export function ActiveTripSection() {
  const { activeTrips, isReady } = useTrips();
  const primaryTrip = activeTrips[0];

  if (!isReady) {
    return (
      <section className="flex flex-col gap-3">
        <SectionHeader title="계획 중인 여행" />
        <div className="h-52 animate-pulse rounded-xl2 bg-surface-soft" />
      </section>
    );
  }

  if (!primaryTrip) {
    return (
      <section className="flex flex-col gap-3">
        <SectionHeader title="계획 중인 여행" />
        <Link
          href="/onboarding"
          className="relative block h-52 w-full overflow-hidden rounded-xl2 shadow-soft transition-transform active:scale-[0.99]"
        >
          <Image
            src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80"
            alt="다음 여행 계획하기"
            fill
            sizes="440px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/20" />

          <div className="absolute left-4 top-4 ai-glass-chip !text-ink-heading !bg-surface-white/90">
            다음 여행 준비
          </div>

          <div className="absolute inset-x-4 bottom-4 text-surface-white">
            <h3 className="text-xl font-extrabold drop-shadow-sm">
              아직 진행 중인 여행이 없어요
            </h3>
            <p className="mt-1 text-xs font-medium opacity-90">
              예산만 알려주면 AI가 코스를 짜드려요
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-surface-white">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
              새 여행 계획하기
            </span>
          </div>
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="계획 중인 여행" />
      <ActiveTripCard trip={primaryTrip} />
    </section>
  );
}
