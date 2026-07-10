"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ActiveTripCard } from "@/components/home/ActiveTripCard";
import { useTrips } from "@/lib/trips/TripProvider";

export function ActiveTripSection() {
  const { activeTrips, isReady } = useTrips();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || activeTrips.length <= 1) {
      setActiveIndex(0);
      return;
    }

    const onScroll = () => {
      const nextIndex = Math.round(container.scrollLeft / container.clientWidth);
      setActiveIndex(nextIndex);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [activeTrips.length]);

  if (!isReady) {
    return (
      <section className="flex flex-col gap-3">
        <SectionHeader title="계획 중인 여행" />
        <div className="h-52 animate-pulse rounded-xl2 bg-surface-soft" />
      </section>
    );
  }

  if (activeTrips.length === 0) {
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
      <SectionHeader
        title="계획 중인 여행"
        actionLabel={activeTrips.length > 1 ? "전체보기" : undefined}
        actionHref="/trips"
      />

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
      >
        {activeTrips.map((trip, index) => (
          <div
            key={trip.id}
            className="w-full shrink-0 snap-center snap-always"
          >
            <ActiveTripCard trip={trip} priority={index === 0} />
          </div>
        ))}
      </div>

      {activeTrips.length > 1 ? (
        <div className="flex items-center justify-center gap-1.5">
          {activeTrips.map((trip, index) => (
            <button
              key={trip.id}
              type="button"
              aria-label={`${trip.destination} 여행 보기`}
              onClick={() => {
                const container = scrollRef.current;
                if (!container) return;
                container.scrollTo({
                  left: container.clientWidth * index,
                  behavior: "smooth",
                });
                setActiveIndex(index);
              }}
              className={[
                "h-1.5 rounded-full transition-all",
                index === activeIndex
                  ? "w-4 bg-brand"
                  : "w-1.5 bg-line-muted",
              ].join(" ")}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
