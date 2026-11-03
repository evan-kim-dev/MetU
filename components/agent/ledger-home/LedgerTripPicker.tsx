"use client";

import { CalendarDays, ChevronRight, MapPin, Plus } from "lucide-react";
import { DestinationImage } from "@/components/ui/DestinationImage";
import { formatKRW } from "@/lib/shared/format";
import { computeTripDDay, formatTripDDayLabel } from "@/lib/trips/d-day";
import type { Trip, TripStatus } from "@/lib/trips/types";
import { groupTripsForLedgerPicker } from "./groupTripsForLedgerPicker";

type Props = {
  trips: Trip[];
  onSelect: (tripId: string) => void;
  onCreate?: () => void;
  /** 마지막으로 본 여행 — 한 번에 이어서 들어가기 */
  continueTrip?: Trip | null;
};

const STATUS_LABEL: Record<TripStatus, string> = {
  ongoing: "여행 중",
  upcoming: "예정",
  completed: "완료",
};

function CompactTripCard({
  trip,
  onSelect,
}: {
  trip: Trip;
  onSelect: (id: string) => void;
}) {
  const dDay = computeTripDDay(trip.dateRange, trip.dDay);
  return (
    <button
      type="button"
      onClick={() => onSelect(trip.id)}
      className="flex min-h-tap w-full items-stretch gap-3 overflow-hidden rounded-2xl bg-surface-white text-left shadow-soft ring-1 ring-line-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[0.99]"
    >
      <span className="relative h-20 w-20 shrink-0 overflow-hidden bg-surface-soft">
        <DestinationImage
          destination={trip.destination}
          country={trip.country}
          storedUrl={trip.imageUrl}
          alt=""
          sizes="80px"
          className="object-cover"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2 pr-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-extrabold text-ink-heading">
            {trip.destination}
          </span>
          <span className="shrink-0 rounded-md bg-surface-soft px-1.5 py-0.5 text-[10px] font-bold text-ink-body">
            {STATUS_LABEL[trip.status]}
          </span>
        </span>
        <span className="truncate text-xs text-ink-caption">
          {trip.dateRange}
          {trip.isOwner === false ? " · 공유받음" : ""}
        </span>
        <span className="truncate text-xs tabular-nums text-ink-body">
          {trip.status === "upcoming"
            ? formatTripDDayLabel(dDay)
            : `지출 ${formatKRW(trip.spent)}`}
        </span>
      </span>
      <span className="flex shrink-0 items-center pr-3 text-ink-caption">
        <ChevronRight className="h-5 w-5" aria-hidden />
      </span>
    </button>
  );
}

function FeaturedOngoingCard({
  trip,
  onSelect,
  priority,
}: {
  trip: Trip;
  onSelect: (id: string) => void;
  priority?: boolean;
}) {
  const remaining = Math.max(0, trip.budget - trip.spent);
  const usedPercent =
    trip.budget > 0
      ? Math.min(100, Math.round((trip.spent / trip.budget) * 100))
      : 0;
  const dDay = computeTripDDay(trip.dateRange, trip.dDay);

  return (
    <button
      type="button"
      onClick={() => onSelect(trip.id)}
      className="relative block h-56 w-full overflow-hidden rounded-2xl text-left shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[0.99]"
    >
      <DestinationImage
        destination={trip.destination}
        country={trip.country}
        storedUrl={trip.imageUrl}
        alt=""
        sizes="440px"
        priority={priority}
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/15" />
      <span className="absolute left-3 top-3 rounded-full bg-mint/90 px-2.5 py-1 text-[11px] font-extrabold text-success backdrop-blur-sm">
        여행 중
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-surface-white/85 px-2.5 py-1 text-[11px] font-extrabold text-brand-strong backdrop-blur-md">
        {formatTripDDayLabel(dDay)}
      </span>
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 text-surface-white">
        <span className="flex items-center gap-1 text-xs font-semibold opacity-90">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {trip.country}
          {trip.isOwner === false ? " · 공유받음" : ""}
        </span>
        <span className="text-2xl font-extrabold drop-shadow-sm">
          {trip.destination}
        </span>
        <span className="flex items-center gap-1 text-xs opacity-90">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {trip.dateRange}
        </span>
        <span className="rounded-xl border border-white/25 bg-white/15 p-3 backdrop-blur-md">
          <span className="flex items-center justify-between text-xs">
            <span className="opacity-90">가계부 열기 · 남은 예산</span>
            <span className="font-extrabold tabular-nums">
              {formatKRW(remaining)}
            </span>
          </span>
          <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/30">
            <span
              className="block h-full rounded-full bg-surface-white"
              style={{ width: `${usedPercent}%` }}
            />
          </span>
        </span>
      </span>
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-extrabold text-ink-heading">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

/** 가계부 탭 진입: 여행 카드로 한눈에 고르고 들어가요. */
export function LedgerTripPicker({
  trips,
  onSelect,
  onCreate,
  continueTrip,
}: Props) {
  const { ongoing, upcoming, completed } = groupTripsForLedgerPicker(trips);
  const hasFeatured = ongoing.length > 0;
  const hasOthers = upcoming.length + completed.length > 0;

  return (
    <div className="flex flex-col gap-5" data-testid="ledger-trip-picker">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-bold text-ink-heading">
          여행을 골라 가계부로 들어가요
        </p>
        <p className="text-xs text-ink-caption">
          이전 여행부터 지금까지 한눈에 볼 수 있어요
        </p>
        {continueTrip ? (
          <button
            type="button"
            onClick={() => onSelect(continueTrip.id)}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-brand/10 px-3 text-sm font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span className="truncate">이어서 · {continueTrip.destination}</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        ) : null}
      </header>

      {hasFeatured ? (
        <Section title={ongoing.length > 1 ? "여행 중" : "지금 여행 중"}>
          {ongoing.map((t, i) => (
            <FeaturedOngoingCard
              key={t.id}
              trip={t}
              onSelect={onSelect}
              priority={i === 0}
            />
          ))}
        </Section>
      ) : null}

      {hasFeatured && hasOthers ? (
        <div
          role="separator"
          aria-label="다른 여행"
          className="flex items-center gap-3"
        >
          <span className="h-px flex-1 bg-line-soft" />
          <span className="shrink-0 text-[11px] font-bold text-ink-caption">
            다른 여행
          </span>
          <span className="h-px flex-1 bg-line-soft" />
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <Section title="예정">
          {upcoming.map((t) => (
            <CompactTripCard key={t.id} trip={t} onSelect={onSelect} />
          ))}
        </Section>
      ) : null}

      {completed.length > 0 ? (
        <Section title="이전 여행">
          {completed.map((t) => (
            <CompactTripCard key={t.id} trip={t} onSelect={onSelect} />
          ))}
        </Section>
      ) : null}

      {onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex min-h-tap items-center justify-center gap-2 rounded-2xl border border-dashed border-brand/40 bg-brand/5 px-3 text-sm font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Plus className="h-4 w-4" aria-hidden />
          새 여행 만들기
        </button>
      ) : null}
    </div>
  );
}
