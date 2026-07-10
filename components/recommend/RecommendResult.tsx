"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BedDouble,
  BookOpen,
  CalendarDays,
  MapPin,
  Plane,
  SquareArrowOutUpRight,
  Wallet,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { AIInsightBadge } from "@/components/ui/AIInsightBadge";
import { BudgetDonutChart } from "@/components/recommend/BudgetDonutChart";
import { formatKRW } from "@/lib/mock/home";
import type { TripRecommendation } from "@/lib/ai/types";
import { buildAgodaUrlFromPlan } from "@/lib/flights/agoda-url";
import { buildAgodaHotelUrlFromPlan } from "@/lib/hotels/agoda-url";
import {
  fetchPlanHotelQuote,
  type PlanHotelQuote,
} from "@/lib/hotels/plan-hotel-quote";
import {
  fetchPlanFlightQuote,
  type PlanFlightQuote,
} from "@/lib/flights/plan-flight-quote";
import { DEFAULTS } from "@/lib/constants";
import { useTrips } from "@/lib/trips/TripProvider";
import type { Trip } from "@/lib/trips/types";

function planToTrip(
  plan: TripRecommendation,
  flightPrice: number,
  flightAirline: string,
  hotelPrice: number,
  hotelName: string
): Trip {
  const expenses = [
    {
      id: "exp-flight",
      category: "교통",
      label: `${flightAirline} 항공권`,
      amount: flightPrice,
      date: "예약 예정",
    },
    {
      id: "exp-hotel",
      category: "숙소",
      label: `${hotelName} ${plan.hotel.nights}박`,
      amount: hotelPrice,
      date: "예약 예정",
    },
  ];

  return {
    id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    destination: plan.destination,
    country: plan.country,
    origin: plan.origin,
    dateRange: plan.dateRange,
    dDay: DEFAULTS.dDayPlaceholder,
    budget: plan.totalBudget,
    spent: flightPrice + hotelPrice,
    people: plan.people,
    styles: plan.form.styles,
    imageUrl: plan.imageUrl,
    memo: plan.summary,
    status: "upcoming",
    expenses,
    budgetAllocation: plan.budgetAllocation,
    dailySchedule: plan.dailySchedule,
    tips: plan.tips,
  };
}

interface RecommendResultProps {
  plan: TripRecommendation;
}

export function RecommendResult({ plan }: RecommendResultProps) {
  const router = useRouter();
  const { addTrip } = useTrips();
  const [flightQuote, setFlightQuote] = useState<PlanFlightQuote | null>(null);
  const [flightQuoteLoading, setFlightQuoteLoading] = useState(true);
  const [hotelQuote, setHotelQuote] = useState<PlanHotelQuote | null>(null);
  const [hotelQuoteLoading, setHotelQuoteLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setFlightQuoteLoading(true);

    void fetchPlanFlightQuote(plan).then((quote) => {
      if (cancelled) return;
      setFlightQuote(quote);
      setFlightQuoteLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [plan]);

  useEffect(() => {
    let cancelled = false;
    setHotelQuoteLoading(true);

    void fetchPlanHotelQuote(plan).then((quote) => {
      if (cancelled) return;
      setHotelQuote(quote);
      setHotelQuoteLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [plan]);

  const agodaFlightUrl =
    flightQuote?.agodaUrl ?? buildAgodaUrlFromPlan(plan) ?? undefined;
  const agodaHotelUrl =
    hotelQuote?.agodaUrl ?? buildAgodaHotelUrlFromPlan(plan) ?? undefined;
  const flightPrice = flightQuote?.priceKrw ?? plan.flight.price;
  const flightAirline = flightQuote?.airline ?? plan.flight.airline;
  const flightRoute = flightQuote?.route ?? plan.flight.route;
  const flightSchedule = flightQuote?.schedule ?? plan.flight.schedule;
  const hotelName = hotelQuote?.name ?? plan.hotel.name;
  const hotelArea = hotelQuote?.area ?? plan.hotel.area;
  const hotelNightsLabel =
    hotelQuote?.nightsLabel ??
    `${plan.hotel.nights}박 · 1박 ${formatKRW(plan.hotel.pricePerNight)}`;
  const hotelPrice = hotelQuote?.priceKrw ?? plan.hotel.total;

  const handleSave = async () => {
    const trip = planToTrip(
      plan,
      flightPrice,
      flightAirline,
      hotelPrice,
      hotelName
    );
    const saved = await addTrip(trip);
    router.push(`/trips/${saved.id}`);
  };

  return (
    <MobileShell title="AI 추천 결과" showBack backHref="/onboarding" showBottomNav={false}>
      <div className="flex flex-col gap-6 px-4 pb-8 pt-5">
        {/* 히어로 */}
        <section className="relative h-48 overflow-hidden rounded-xl2 shadow-soft">
          <Image
            src={plan.imageUrl}
            alt={plan.destination}
            fill
            sizes="440px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-surface-white">
            <p className="text-xs font-semibold opacity-90">
              {plan.origin} → {plan.destination}
            </p>
            <h2 className="text-2xl font-extrabold">{plan.destination} 여행</h2>
            <p className="mt-1 text-sm opacity-90">{plan.dateRange}</p>
          </div>
        </section>

        <AIInsightBadge variant={plan.summaryTone === "factbomb" ? "factbomb" : "insight"}>
          {plan.summary}
        </AIInsightBadge>

        <section className="rounded-xl2 border border-line-soft bg-surface-white p-4">
          <h3 className="mb-2 text-sm font-extrabold text-ink-heading">입력 요약</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-ink-body">
            <p>출발지: {plan.form.origin}</p>
            <p>목적지: {plan.form.destination}</p>
            <p>예산(총): {plan.form.budget}원</p>
            <p>인원: {plan.form.people}명</p>
          </div>
        </section>

        {plan.ragSources?.length > 0 && (
          <section className="rounded-xl2 border border-line-soft bg-surface-white p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand" />
              <h3 className="text-lg font-extrabold text-ink-heading">
                AI가 참고한 내용
              </h3>
            </div>
            <p className="mb-3 text-xs text-ink-caption">
              아래 지식을 바탕으로 예산·시즌·일정 추천을 만들었어요.
            </p>
            <div className="flex flex-col gap-2.5">
              {plan.ragSources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-xl border border-line-soft bg-surface-base px-3.5 py-3"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                      {source.category}
                    </span>
                    <span className="text-xs font-extrabold text-ink-heading">
                      {source.title}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-ink-body">
                    {source.content}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 스타일 태그 */}
        <div className="flex flex-wrap gap-2">
          {plan.styleLabels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-brand-strong"
            >
              {label}
            </span>
          ))}
        </div>

        {/* 예산 분배 */}
        <section className="rounded-xl2 bg-surface-white p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-extrabold text-ink-heading">예산 분배</h3>
          </div>
          <BudgetDonutChart
            items={plan.budgetAllocation}
            totalBudget={plan.totalBudget}
            people={plan.people}
          />
        </section>

        {/* 항공 */}
        <section className="rounded-xl2 border border-line-soft bg-surface-white p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-brand" />
              <h3 className="text-lg font-extrabold text-ink-heading">항공권</h3>
            </div>
            {agodaFlightUrl ? (
              <a
                href={agodaFlightUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Agoda 항공권 검색 바로가기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-caption transition-colors hover:bg-surface-soft active:bg-surface-base"
              >
                <SquareArrowOutUpRight className="h-4.5 w-4.5" strokeWidth={2.2} />
              </a>
            ) : (
              <Link
                href="/checklist/flight"
                aria-label="항공권 검색 바로가기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-caption transition-colors hover:bg-surface-soft active:bg-surface-base"
              >
                <SquareArrowOutUpRight className="h-4.5 w-4.5" strokeWidth={2.2} />
              </Link>
            )}
          </div>
          <p className="font-bold text-ink-heading">{flightAirline}</p>
          <p className="mt-1 text-sm text-ink-body">{flightRoute}</p>
          <p className="text-sm text-ink-caption">{flightSchedule}</p>
          {agodaFlightUrl ? (
            <a
              href={agodaFlightUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block rounded-lg transition-colors hover:bg-surface-soft active:bg-surface-base"
            >
              {flightQuoteLoading ? (
                <div className="h-7 w-28 animate-pulse rounded-md bg-surface-soft" />
              ) : (
                <p className="text-lg font-extrabold text-brand">
                  {formatKRW(flightPrice)}
                </p>
              )}
              <p className="mt-1 text-xs text-ink-caption">
                {flightQuote?.source === "live"
                  ? "실시간 최저가 · Agoda에서 같은 조건으로 검색"
                  : "예상가 · Agoda에서 검색"}
              </p>
            </a>
          ) : (
            <p className="mt-2 text-lg font-extrabold text-brand">
              {formatKRW(flightPrice)}
            </p>
          )}
          <p className="mt-1 text-xs text-ink-caption">{plan.flight.note}</p>
        </section>

        {/* 숙소 */}
        <section className="rounded-xl2 border border-line-soft bg-surface-white p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-brand" />
              <h3 className="text-lg font-extrabold text-ink-heading">숙소</h3>
            </div>
            {agodaHotelUrl ? (
              <a
                href={agodaHotelUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Agoda 숙소 검색 바로가기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-caption transition-colors hover:bg-surface-soft active:bg-surface-base"
              >
                <SquareArrowOutUpRight className="h-4.5 w-4.5" strokeWidth={2.2} />
              </a>
            ) : (
              <Link
                href="/checklist/hotel"
                aria-label="숙소 검색 바로가기"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-caption transition-colors hover:bg-surface-soft active:bg-surface-base"
              >
                <SquareArrowOutUpRight className="h-4.5 w-4.5" strokeWidth={2.2} />
              </Link>
            )}
          </div>
          <p className="font-bold text-ink-heading">{hotelName}</p>
          <div className="mt-1 flex items-center gap-1 text-sm text-ink-caption">
            <MapPin className="h-3.5 w-3.5" />
            {hotelArea}
          </div>
          <p className="mt-2 text-sm text-ink-body">{hotelNightsLabel}</p>
          {agodaHotelUrl ? (
            <a
              href={agodaHotelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block rounded-lg transition-colors hover:bg-surface-soft active:bg-surface-base"
            >
              {hotelQuoteLoading ? (
                <div className="h-7 w-28 animate-pulse rounded-md bg-surface-soft" />
              ) : (
                <p className="text-lg font-extrabold text-brand">
                  {formatKRW(hotelPrice)}
                </p>
              )}
              <p className="mt-1 text-xs text-ink-caption">
                {hotelQuote?.source === "live"
                  ? "실시간 최저가 · Agoda에서 같은 조건으로 검색"
                  : "예상가 · Agoda에서 검색"}
              </p>
            </a>
          ) : (
            <p className="mt-1 text-lg font-extrabold text-brand">
              {formatKRW(hotelPrice)}
            </p>
          )}
          <p className="mt-1 text-xs text-ink-caption">{plan.hotel.note}</p>
        </section>

        {/* 일정 */}
        <section className="rounded-xl2 bg-surface-white p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-extrabold text-ink-heading">일정표</h3>
          </div>
          <div className="flex flex-col gap-4">
            {plan.dailySchedule.map((day) => (
              <div
                key={day.day}
                className="rounded-xl border border-line-soft bg-surface-base p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-brand">
                    Day {day.day}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {day.items.map((item) => (
                    <div
                      key={`${day.day}-${item.time}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-ink-caption">
                          {item.time}
                        </p>
                        <p className="text-sm font-medium text-ink-body">
                          {item.title}
                        </p>
                      </div>
                      {item.cost > 0 && (
                        <span className="shrink-0 text-xs font-bold text-ink-heading">
                          {formatKRW(item.cost)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t border-line-soft pt-2 text-right text-xs font-bold text-brand">
                  일일 예상 {formatKRW(day.dayTotal)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* AI 팁 */}
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-extrabold text-ink-heading">AI 팁</h3>
          {plan.tips.map((tip) => (
            <p
              key={tip}
              className="rounded-xl border border-line-soft bg-surface-white px-4 py-3 text-sm text-ink-body"
            >
              {tip}
            </p>
          ))}
        </section>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <PrimaryButton onClick={handleSave}>이 일정 저장하기</PrimaryButton>
          <PrimaryButton variant="secondary" onClick={() => router.push("/")}>
            홈으로 돌아가기
          </PrimaryButton>
        </div>
      </div>
    </MobileShell>
  );
}
