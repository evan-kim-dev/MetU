"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { MapPoint } from "@/lib/map/trip-points";
import { extractMapPoints } from "@/lib/map/trip-points";
import { hasBrowserMapKeys, mapProviderFor } from "@/lib/map/provider";
import { regionOf } from "@/lib/geo/region";
import type { TripDaySchedule } from "@/lib/trips/types";

const TripMap = dynamic(
  () =>
    import("@/components/map/TripMap").then((m) => ({ default: m.TripMap })),
  { ssr: false }
);

export interface TripMapPanelProps {
  days: TripDaySchedule[];
  country?: string;
  destination?: string;
  spendByPlaceId?: Record<string, number>;
  onSelectPoint?: (point: MapPoint) => void;
  highlightKey?: string;
  draggableMarkers?: boolean;
  onMarkerDragEnd?: (
    point: MapPoint,
    next: { lat: number; lng: number }
  ) => void;
}

export function TripMapPanel(props: TripMapPanelProps) {
  const [selectedDay, setSelectedDay] = useState<number | "all">("all");
  const [showSpend, setShowSpend] = useState(false);
  const hasSpend =
    props.spendByPlaceId != null &&
    Object.keys(props.spendByPlaceId).length > 0;
  const points = useMemo(
    () => extractMapPoints(props.days),
    [props.days]
  );

  const canShow = useMemo(() => {
    if (points.length < 2) return false;
    const region = regionOf({
      country: props.country,
      destination: props.destination,
    });
    return mapProviderFor(region, hasBrowserMapKeys()) != null;
  }, [points.length, props.country, props.destination]);

  if (!canShow) return null;

  const dayNums = props.days.map((d) => d.day);
  const visible =
    selectedDay === "all"
      ? points
      : points.filter((p) => p.day === selectedDay);

  return (
    <section className="rounded-2xl border-0 bg-surface-white p-5 shadow-sm">
      {hasSpend ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setShowSpend((v) => !v)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              showSpend
                ? "bg-brand text-white"
                : "bg-surface-soft text-ink-body active:bg-line-soft"
            }`}
          >
            지출 보기
          </button>
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap gap-2">
        <FilterChip
          active={selectedDay === "all"}
          onClick={() => setSelectedDay("all")}
          label="전체"
        />
        {dayNums.map((d) => (
          <FilterChip
            key={d}
            active={selectedDay === d}
            onClick={() => setSelectedDay(d)}
            label={`${d}일차`}
          />
        ))}
      </div>

      <TripMap
        days={props.days}
        selectedDay={selectedDay}
        highlightKey={props.highlightKey}
        onSelectPoint={props.onSelectPoint}
        spendByPlaceId={showSpend ? props.spendByPlaceId : undefined}
        draggableMarkers={props.draggableMarkers}
        onMarkerDragEnd={props.onMarkerDragEnd}
        country={props.country}
        destination={props.destination}
        className="h-64 w-full rounded-2xl"
      />

      <ol className="mt-3 flex flex-col gap-1.5">
        {visible.slice(0, 12).map((p) => (
          <li
            key={p.key}
            className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${
              props.highlightKey === p.key
                ? "ring-2 ring-brand bg-brand/5"
                : ""
            }`}
          >
            <span className="shrink-0 font-bold text-ink-caption">
              {p.time}
            </span>
            <span className="font-semibold text-ink-heading">{p.title}</span>
            {p.hoursKnown === false ? (
              <span className="ml-auto shrink-0 text-[11px] text-ink-caption">
                영업시간 확인 필요
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
        active
          ? "bg-brand text-white"
          : "bg-surface-soft text-ink-body active:bg-line-soft"
      }`}
    >
      {label}
    </button>
  );
}
