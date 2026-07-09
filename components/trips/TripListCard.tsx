"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Check, ChevronRight, MapPin } from "lucide-react";
import { formatKRW } from "@/lib/mock/home";
import type { Trip } from "@/lib/trips/types";

interface TripListCardProps {
  trip: Trip;
  editMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const STATUS_LABEL: Record<Trip["status"], string> = {
  upcoming: "예정",
  ongoing: "진행 중",
  completed: "완료",
};

export function TripListCard({
  trip,
  editMode = false,
  selected = false,
  onToggleSelect,
}: TripListCardProps) {
  const remaining = trip.budget - trip.spent;
  const usedPercent = Math.round((trip.spent / trip.budget) * 100);

  const content = (
    <>
      {editMode && (
        <span
          className={[
            "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selected
              ? "border-brand bg-brand text-surface-white"
              : "border-line-muted bg-surface-white",
          ].join(" ")}
          aria-hidden
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      )}

      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
        <Image
          src={trip.imageUrl}
          alt={`${trip.destination} 여행`}
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs font-semibold text-ink-caption">
              <MapPin className="h-3.5 w-3.5" />
              {trip.country}
            </div>
            <h3 className="truncate text-lg font-extrabold text-ink-heading">
              {trip.destination}
            </h3>
          </div>
          <span className="shrink-0 rounded-full bg-surface-soft px-2.5 py-1 text-[11px] font-bold text-brand-strong">
            {trip.status === "upcoming"
              ? `D-${trip.dDay}`
              : STATUS_LABEL[trip.status]}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-ink-caption">
          <CalendarDays className="h-3.5 w-3.5" />
          {trip.dateRange}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-ink-caption">
            남은 예산 {formatKRW(remaining)}
          </span>
          <span className="font-bold text-brand">{usedPercent}% 사용</span>
        </div>
      </div>

      {!editMode && (
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 self-center text-ink-caption" />
      )}
    </>
  );

  const baseClass =
    "flex gap-3 rounded-xl2 border bg-surface-white p-3 shadow-soft transition-transform active:scale-[0.99]";

  if (editMode) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelect?.(trip.id)}
        aria-pressed={selected}
        className={[
          baseClass,
          "w-full text-left",
          selected ? "border-brand ring-2 ring-brand/20" : "border-line-soft",
        ].join(" ")}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={`/trips/${trip.id}`}
      className={`${baseClass} border-line-soft`}
    >
      {content}
    </Link>
  );
}
