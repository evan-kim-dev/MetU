"use client";

import { useMemo, useState } from "react";
import { BedDouble, ExternalLink } from "lucide-react";
import { Counter } from "@/components/ui/Counter";
import { DateField } from "@/components/ui/DateField";
import {
  buildAgodaHotelSearchUrl,
  buildGoogleHotelSearchUrl,
  resolveHotelStayDates,
} from "@/lib/hotels/agoda-url";
import { resolveAgodaCityId } from "@/lib/hotels/agoda-cities";
import { HOTEL_DESTINATION_SUGGESTIONS } from "@/lib/hotels/destinations";
import { todayIsoDate } from "@/lib/shared/dates";
import type { OnboardingForm } from "@/lib/onboarding/types";
import { travelLinksEnabled } from "@/lib/travel/links-enabled";

const HOTEL_CHECK_ITEMS = [
  "무료 취소 마감일 확인",
  "체크인/체크아웃 시간",
  "결제 방식 / 보증금",
];

function defaultDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function HotelChecklistContent() {
  const todayIso = todayIsoDate();
  const [destination, setDestination] = useState("도쿄");
  const [checkIn, setCheckIn] = useState(defaultDate(30));
  const [checkOut, setCheckOut] = useState(defaultDate(32));
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);

  const hotelSearchUrl = useMemo(() => {
    if (!destination.trim()) return null;
    const cityId = resolveAgodaCityId(destination);
    if (!cityId) return buildGoogleHotelSearchUrl(destination);
    if (!checkIn || !checkOut) return null;
    const fakeForm = {
      dateType: "specific",
      startDate: checkIn,
      endDate: checkOut,
    } as OnboardingForm;
    const nights = Math.max(
      1,
      Math.round(
        (new Date(`${checkOut}T12:00:00`).getTime() -
          new Date(`${checkIn}T12:00:00`).getTime()) /
          86_400_000
      )
    );
    const stay = resolveHotelStayDates(fakeForm, nights);
    return buildAgodaHotelSearchUrl({
      cityId,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      los: stay.los,
      adults,
      rooms,
    });
  }, [adults, checkIn, checkOut, destination, rooms]);

  if (!travelLinksEnabled()) {
    return (
      <div className="px-5 py-8 text-sm text-ink-body">
        항공/호텔 검색은 준비 중이에요
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-10 pt-4">
      <div className="flex items-center gap-2 text-ink-heading">
        <BedDouble className="h-5 w-5" aria-hidden />
        <h2 className="text-lg font-extrabold">숙소 검색</h2>
      </div>
      <p className="text-sm text-ink-body">
        가격은 예약처에서 확인해요. Agoda 검색을 새 탭에서 열어요.
      </p>

      <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-heading">
        목적지
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          list="hotel-dest-suggestions"
          className="h-touch rounded-2xl border border-line bg-white px-4 text-base font-medium"
          placeholder="도쿄"
        />
        <datalist id="hotel-dest-suggestions">
          {HOTEL_DESTINATION_SUGGESTIONS.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-heading">
          체크인
          <DateField
            value={checkIn}
            min={todayIso}
            onChange={setCheckIn}
            aria-label="체크인"
            className="h-touch rounded-2xl border border-line bg-white px-3"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-heading">
          체크아웃
          <DateField
            value={checkOut}
            min={checkIn || todayIso}
            onChange={setCheckOut}
            aria-label="체크아웃"
            className="h-touch rounded-2xl border border-line bg-white px-3"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink-heading">인원</span>
          <Counter value={adults} min={1} max={9} onChange={setAdults} unit="명" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink-heading">객실</span>
          <Counter value={rooms} min={1} max={4} onChange={setRooms} unit="개" />
        </div>
      </div>

      <a
        href={hotelSearchUrl ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!hotelSearchUrl}
        className={`flex h-touch items-center justify-center gap-2 rounded-2xl text-sm font-bold ${
          hotelSearchUrl
            ? "bg-ink-heading text-white active:opacity-90"
            : "pointer-events-none bg-surface-muted text-ink-caption opacity-60"
        }`}
      >
        {hotelSearchUrl?.includes("google.com")
          ? "Google에서 검색"
          : "Agoda에서 검색"}
        <ExternalLink className="h-4 w-4" aria-hidden />
      </a>

      <ul className="mt-2 space-y-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-body">
        {HOTEL_CHECK_ITEMS.map((item) => (
          <li key={item} className="list-disc pl-1">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
