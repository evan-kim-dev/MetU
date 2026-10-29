"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Plane } from "lucide-react";
import { AirportSearchField } from "@/components/onboarding/AirportSearchField";
import { Counter } from "@/components/ui/Counter";
import { DateField } from "@/components/ui/DateField";
import type { AirportPlace } from "@/lib/airports/data";
import { formatAirportInputLabel } from "@/lib/airports/data";
import { buildAgodaFlightSearchUrl, resolveIataCode } from "@/lib/flights/agoda-url";
import { buildGoogleFlightsSearchUrl } from "@/lib/flights/google-flights-url";
import { buildNaverFlightsUrl } from "@/lib/flights/naver-flights-url";
import { todayIsoDate } from "@/lib/shared/dates";
import { travelLinksEnabled } from "@/lib/travel/links-enabled";

const FLIGHT_CHECK_ITEMS = [
  "여권 영문 이름과 항공권 이름 철자 일치",
  "수하물 규정(기내/위탁)과 추가 요금 확인",
  "출국 24시간 전 온라인 체크인 가능 여부 확인",
];

function defaultDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function formatFlightSearchValue(place: AirportPlace): string {
  return formatAirportInputLabel(place);
}

export function FlightChecklistContent() {
  const todayIso = todayIsoDate();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departDate, setDepartDate] = useState(defaultDate(30));
  const [returnDate, setReturnDate] = useState(defaultDate(37));
  const [adults, setAdults] = useState(1);

  const links = useMemo(() => {
    const o = resolveIataCode(origin);
    const d = resolveIataCode(destination);
    if (!o || !d || !departDate || !returnDate) return null;
    return {
      google: buildGoogleFlightsSearchUrl({
        origin: o,
        destination: d,
        departDate,
        returnDate,
        adults,
      }),
      naver: buildNaverFlightsUrl({
        origin: o,
        destination: d,
        departDate,
        returnDate,
        adults,
      }),
      agoda: buildAgodaFlightSearchUrl({
        departureFrom: o,
        arrivalTo: d,
        departDate,
        returnDate,
        adults,
      }),
    };
  }, [adults, departDate, destination, origin, returnDate]);

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
        <Plane className="h-5 w-5" aria-hidden />
        <h2 className="text-lg font-extrabold">항공권 검색</h2>
      </div>
      <p className="text-sm text-ink-body">
        가격은 예약처에서 확인해요. 아래 버튼으로 검색 화면을 열어요.
      </p>

      <AirportSearchField
        label="출발"
        placeholder="인천 (ICN)"
        value={origin}
        onChange={setOrigin}
        formatValue={formatFlightSearchValue}
      />
      <AirportSearchField
        label="도착"
        placeholder="도쿄 나리타 (NRT)"
        value={destination}
        onChange={setDestination}
        formatValue={formatFlightSearchValue}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-heading">
          가는 날
          <DateField
            value={departDate}
            min={todayIso}
            onChange={setDepartDate}
            aria-label="가는 날"
            className="h-touch rounded-2xl border border-line bg-white px-3"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-heading">
          오는 날
          <DateField
            value={returnDate}
            min={departDate || todayIso}
            onChange={setReturnDate}
            aria-label="오는 날"
            className="h-touch rounded-2xl border border-line bg-white px-3"
          />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-ink-heading">인원</span>
        <Counter value={adults} min={1} max={9} onChange={setAdults} unit="명" />
      </div>

      <div className="flex flex-col gap-2">
        {(
          [
            ["Google 항공권", links?.google],
            ["네이버 항공권", links?.naver],
            ["Agoda", links?.agoda],
          ] as const
        ).map(([label, href]) => (
          <a
            key={label}
            href={href ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!href}
            className={`flex h-touch items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-opacity ${
              href
                ? "bg-ink-heading text-white active:opacity-90"
                : "pointer-events-none bg-surface-muted text-ink-caption opacity-60"
            }`}
          >
            {label}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ))}
      </div>

      <ul className="mt-2 space-y-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-body">
        {FLIGHT_CHECK_ITEMS.map((item) => (
          <li key={item} className="list-disc pl-1">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
