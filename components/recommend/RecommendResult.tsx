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
  Sparkles,
  SquareArrowOutUpRight,
  Wallet,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { AIInsightBadge } from "@/components/ui/AIInsightBadge";
import { BudgetDonutChart } from "@/components/recommend/BudgetDonutChart";
import { usePlanQuotes } from "@/components/recommend/usePlanQuotes";
import { formatKRW } from "@/lib/shared/format";
import type { TripRecommendation } from "@/lib/ai/types";
import { buildAgodaUrlFromPlan } from "@/lib/flights/agoda-url";
import { buildAgodaHotelUrlFromPlan } from "@/lib/hotels/agoda-url";
import { useTrips } from "@/lib/trips/TripProvider";
import { planToTrip } from "@/components/recommend/planToTrip";

interface RecommendResultProps {
  plan: TripRecommendation;
  /** true면 폴백을 먼저 보여주고 뒤에서 AI 보강 */
  enrich?: boolean;
}

export function RecommendResult({
  plan: initialPlan,
  enrich = false,
}: RecommendResultProps) {
  const router = useRouter();
  const { addTrip } = useTrips();
  const [plan, setPlan] = useState(initialPlan);
  const [enriching, setEnriching] = useState(enrich);
  const {
    flightQuote,
    hotelQuote,
    flightQuoteLoading,
    hotelQuoteLoading,
  } = usePlanQuotes(plan);

  useEffect(() => {
    setPlan(initialPlan);
    setEnriching(enrich);
  }, [initialPlan.id, enrich]); // eslint-disable-line react-hooks/exhaustive-deps -- 새 폴백만 동기화

  useEffect(() => {
    if (!enrich) return;

    let cancelled = false;
    setEnriching(true);

    void fetch("/api/onboarding/enrich-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form: initialPlan.form, plan: initialPlan }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("enrich-failed");
        return (await res.json()) as { plan?: TripRecommendation };
      })
      .then((data) => {
        if (cancelled || !data.plan) return;
        setPlan(data.plan);
      })
      .catch(() => {
        // 폴백 일정 유지
      })
      .finally(() => {
        if (!cancelled) setEnriching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enrich, initialPlan.id]); // eslint-disable-line react-hooks/exhaustive-deps -- 동일 일정 1회 보강

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
        {enriching ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-xl2 border border-brand/15 bg-brand/5 px-3.5 py-2.5 text-sm text-brand-strong"
          >
            <Sparkles
              className="h-4 w-4 shrink-0 motion-safe:animate-pulse"
              strokeWidth={2.2}
              aria-hidden
            />
            <span className="font-semibold">AI가 맞춤 일정을 다듬고 있어요…</span>
          </div>
        ) : null}

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

        <section className="rounded-xl2 border border-line-soft bg-surface-white p-5 shadow-soft">
          <h3 className="mb-2 text-sm font-extrabold text-ink-heading">입력 요약</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-ink-body">
            <p>출발지: {plan.form.origin}</p>
            <p>목적지: {plan.form.destination}</p>
            <p>예산(총): {plan.form.budget}원</p>
            <p>인원: {plan.form.people}명</p>
          </div>
        </section>

        {plan.ragSources?.length > 0 && (
          <section className="rounded-xl2 border border-line-soft bg-surface-white p-6 shadow-soft">
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
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-2xs font-bold text-brand">
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

        <section className="rounded-xl2 bg-surface-white p-6 shadow-soft">
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

        <section
          className={[
            "rounded-xl2 border border-line-soft bg-surface-white p-6 shadow-soft transition-opacity",
            enriching ? "opacity-90" : "",
          ].join(" ")}
        >
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

        <section
          className={[
            "rounded-xl2 border border-line-soft bg-surface-white p-6 shadow-soft transition-opacity",
            enriching ? "opacity-90" : "",
          ].join(" ")}
        >
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

        <section className="rounded-xl2 bg-surface-white p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-extrabold text-ink-heading">일정표</h3>
            {enriching ? (
              <span className="ml-auto text-xs font-semibold text-brand">
                다듬는 중
              </span>
            ) : null}
          </div>
          <div
            className={[
              "flex flex-col gap-4 transition-opacity",
              enriching ? "opacity-85" : "",
            ].join(" ")}
          >
            {plan.dailySchedule.map((day) => (
              <div
                key={day.day}
                className="rounded-xl2 border border-line-soft bg-surface-soft p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-brand">
                    Day {day.day}
                    {day.label ? ` · ${day.label}` : ""}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {day.items.map((item) => (
                    <div
                      key={`${day.day}-${item.time}-${item.title}`}
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

        {plan.tips.length > 0 ? (
          <section className="rounded-xl2 border border-line-soft bg-surface-white p-5 shadow-soft">
            <h3 className="mb-3 text-lg font-extrabold text-ink-heading">AI 팁</h3>
            <div className="space-y-2.5 text-sm leading-relaxed text-ink-body">
              {plan.tips.map((tip, index) => (
                <p key={`${index}-${tip.slice(0, 24)}`}>{tip}</p>
              ))}
            </div>
          </section>
        ) : null}

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
