"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BedDouble, CalendarDays, Plane, X } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { DealPlace } from "@/lib/deals/data";
import { resolveIataCode } from "@/lib/flights/agoda-url";
import { buildGoogleFlightsSearchUrl } from "@/lib/flights/google-flights-url";
import { addDays, todayIsoDate } from "@/lib/shared/dates";
import { useTrips } from "@/lib/trips/TripProvider";

interface DealDetailSheetProps {
  place: DealPlace;
  onClose: () => void;
}

function buildGoogleHotelsSearchUrl(city: string): string {
  const url = new URL("https://www.google.com/travel/search");
  url.searchParams.set("q", `${city} 호텔`);
  url.searchParams.set("hl", "ko");
  return url.toString();
}

function buildDealFlightsUrl(
  originQuery: string,
  destinationName: string
): string | null {
  const origin = resolveIataCode(originQuery);
  const destination = resolveIataCode(destinationName);
  if (!origin || !destination) return null;

  const departDate = addDays(todayIsoDate(), 14);
  const returnDate = addDays(departDate, 4);
  return buildGoogleFlightsSearchUrl({
    origin,
    destination,
    departDate,
    returnDate,
  });
}

export function DealDetailSheet({ place, onClose }: DealDetailSheetProps) {
  const router = useRouter();
  const { activeTrips, trips } = useTrips();
  const defaultOrigin =
    activeTrips[0]?.origin?.trim() || trips[0]?.origin?.trim() || "";

  const flightsUrl = useMemo(
    () =>
      defaultOrigin
        ? buildDealFlightsUrl(defaultOrigin, place.name)
        : null,
    [defaultOrigin, place.name]
  );
  const hotelsUrl = useMemo(
    () => buildGoogleHotelsSearchUrl(place.name),
    [place.name]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(85dvh,680px)] w-full max-w-mobile flex-col overflow-hidden rounded-3xl bg-surface-base shadow-soft">
        <div className="relative h-44 shrink-0">
          <Image
            src={place.imageUrl}
            alt={place.name}
            fill
            sizes="440px"
            className="object-cover"
            priority
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <button
            type="button"
            aria-label="시트 닫기"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-surface-white backdrop-blur-sm"
          >
            <X className="h-5 w-5" strokeWidth={2.3} />
          </button>
          <div className="absolute bottom-4 left-4 right-4 text-surface-white">
            <p className="text-xs font-semibold opacity-90">{place.country}</p>
            <h3 className="text-2xl font-extrabold">{place.name}</h3>
            <p className="mt-1 text-sm font-bold text-[#93C5FD]">
              {place.budgetLabel} · {place.highlight}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-line-soft bg-surface-white px-4 py-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-brand" />
              <div>
                <p className="text-xs font-semibold text-ink-caption">추천 시기</p>
                <p className="text-sm font-bold text-ink-heading">
                  {place.bestMonth}
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-ink-body">
              {place.highlight}
            </p>

            <div className="flex flex-col gap-2">
              {flightsUrl ? (
                <a
                  href={flightsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-soft bg-surface-white px-4 py-3 text-sm font-bold text-ink-heading transition-colors hover:bg-surface-soft"
                >
                  <Plane className="h-4 w-4 text-brand" />
                  항공권 검색(Google Flights)
                </a>
              ) : null}
              <a
                href={hotelsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-soft bg-surface-white px-4 py-3 text-sm font-bold text-ink-heading transition-colors hover:bg-surface-soft"
              >
                <BedDouble className="h-4 w-4 text-brand" />
                호텔 검색(Google 호텔)
              </a>
            </div>

            <p className="text-xs leading-relaxed text-ink-caption">
              가격은 표시하지 않아요. 검색 링크에서 날짜·좌석에 맞는 실제 요금을
              확인해주세요.
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-line-soft bg-surface-white px-5 py-4">
          <PrimaryButton
            onClick={() => {
              onClose();
              router.push("/onboarding");
            }}
          >
            이 여행지로 계획 시작하기
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
