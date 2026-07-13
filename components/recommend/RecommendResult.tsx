"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DestinationImage } from "@/components/ui/DestinationImage";
import { AIInsightBadge } from "@/components/ui/AIInsightBadge";
import { EasterEggCelebration } from "@/components/ui/EasterEggCelebration";
import { BudgetDonutChart } from "@/components/recommend/BudgetDonutChart";
import { usePlanQuotes } from "@/components/recommend/usePlanQuotes";
import { formatKRW } from "@/lib/shared/format";
import { planHasEasterEgg } from "@/lib/ai/budget-reality-check";
import { reallocateBudgetWithLiveQuotes } from "@/lib/ai/realloc-budget";
import type { TripRecommendation } from "@/lib/ai/types";
import { buildGoogleFlightsUrlFromPlan } from "@/lib/flights/google-flights-url";
import { buildAgodaHotelUrlFromPlan } from "@/lib/hotels/agoda-url";
import { useTrips } from "@/lib/trips/TripProvider";
import { planToTrip } from "@/components/recommend/planToTrip";

function liveQuoteCaption(
  kind: "flight" | "hotel",
  source: "live" | "estimate" | undefined,
  withinBand: boolean | undefined
): string {
  if (kind === "flight") {
    if (source !== "live") return "예상가 · Google Flights에서 확인";
    if (withinBand === false) {
      return "Google Flights 실시간 최저가 · 예산 밴드(45%) 초과";
    }
    return "Google Flights 실시간 최저가";
  }
  if (source !== "live") return "예상가 · Agoda에서 검색";
  if (withinBand === false) {
    return "실시간 최저가 · 예산 밴드(40%) 초과";
  }
  return "실시간 최저가 · 예산 밴드 내";
}

const EASTER_CELEB_PREFIX = "metu:easter-celeb:v2:";

function easterCelebKey(destination: string) {
  return `${EASTER_CELEB_PREFIX}${destination.trim().toLowerCase()}`;
}

function wasEasterCelebrated(destination: string): boolean {
  try {
    return sessionStorage.getItem(easterCelebKey(destination)) === "1";
  } catch {
    return false;
  }
}

function markEasterCelebrated(destination: string) {
  try {
    sessionStorage.setItem(easterCelebKey(destination), "1");
  } catch {
    // ignore
  }
}

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

  const isUnrealistic = plan.summaryTone === "factbomb";
  const isEasterEgg = planHasEasterEgg(plan);
  const [showEasterCelebration, setShowEasterCelebration] = useState(false);

  const closeEasterCelebration = useCallback(() => {
    setShowEasterCelebration(false);
    markEasterCelebrated(initialPlan.destination || initialPlan.form.destination);
  }, [initialPlan.destination, initialPlan.form.destination]);

  useEffect(() => {
    setPlan(initialPlan);
    setEnriching(enrich && initialPlan.summaryTone !== "factbomb");
  }, [initialPlan.id, enrich]); // eslint-disable-line react-hooks/exhaustive-deps -- 새 폴백만 동기화

  useEffect(() => {
    if (!planHasEasterEgg(initialPlan)) {
      setShowEasterCelebration(false);
      return;
    }
    // sessionStorage는 닫을 때만 기록 — Strict Mode 재실행 시 팝업이 바로 꺼지는 것 방지
    if (wasEasterCelebrated(initialPlan.destination || initialPlan.form.destination)) {
      setShowEasterCelebration(false);
      return;
    }
    setShowEasterCelebration(true);
  }, [initialPlan]);

  useEffect(() => {
    if (!enrich || initialPlan.summaryTone === "factbomb") {
      setEnriching(false);
      return;
    }

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

  const flightBookingUrl =
    flightQuote?.googleFlightsUrl ??
    buildGoogleFlightsUrlFromPlan(plan) ??
    undefined;
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

  const liveBudget = useMemo(() => {
    const hasLive =
      flightQuote?.source === "live" || hotelQuote?.source === "live";
    if (!hasLive) {
      return {
        items: plan.budgetAllocation,
        remaining: plan.totalBudget - plan.flight.price - plan.hotel.total,
        overBudget: false,
        adjusted: false,
      };
    }
    const result = reallocateBudgetWithLiveQuotes(
      plan.budgetAllocation,
      plan.totalBudget,
      flightPrice,
      hotelPrice
    );
    return { ...result, adjusted: true };
  }, [
    plan.budgetAllocation,
    plan.totalBudget,
    plan.flight.price,
    plan.hotel.total,
    flightQuote?.source,
    hotelQuote?.source,
    flightPrice,
    hotelPrice,
  ]);

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
      <EasterEggCelebration
        open={showEasterCelebration}
        destination={plan.destination}
        onClose={closeEasterCelebration}
      />
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

        <section className="relative h-48 overflow-hidden rounded-xl2 bg-surface-soft shadow-soft">
          <DestinationImage
            destination={plan.destination}
            country={plan.country}
            storedUrl={plan.imageUrl}
            alt={plan.destination}
            sizes="440px"
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

        <AIInsightBadge
          variant={
            isEasterEgg
              ? "easter"
              : plan.summaryTone === "factbomb"
                ? "factbomb"
                : "insight"
          }
        >
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

        {isUnrealistic ? (
          <section className="rounded-xl2 border border-line-soft bg-surface-white p-5 shadow-soft">
            <p className="text-sm leading-relaxed text-ink-body">
              지금은 현실적인 일정을 만들기 어려워요. 예산을 올리거나 인원·목적지를
              바꾼 뒤 다시 추천받아 보세요.
            </p>
            <PrimaryButton
              className="mt-4"
              variant="secondary"
              onClick={() => router.push("/onboarding")}
            >
              조건 다시 입력하기
            </PrimaryButton>
          </section>
        ) : (
          <>
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
            {liveBudget.adjusted ? (
              <span className="ml-auto rounded-full bg-brand/10 px-2.5 py-1 text-2xs font-bold text-brand">
                실시간가 반영
              </span>
            ) : null}
          </div>
          {liveBudget.overBudget ? (
            <p className="mb-3 rounded-xl2 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
              항공·숙소 실시간가만으로 이미 총예산을{" "}
              {formatKRW(Math.abs(liveBudget.remaining))} 초과해요. 날짜·인원·목적지를
              조정하거나 예산을 올려 보세요.
            </p>
          ) : liveBudget.adjusted ? (
            <p className="mb-3 text-xs leading-relaxed text-ink-caption">
              항공·숙소는 실시간 시세로 고정하고, 남은{" "}
              {formatKRW(Math.max(0, liveBudget.remaining))}을 식비·교통·관광에
              다시 나눴어요.
            </p>
          ) : null}
          <BudgetDonutChart
            items={liveBudget.items}
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
            {flightBookingUrl ? (
              <a
                href={flightBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Google Flights 항공권 검색 바로가기"
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
          {flightBookingUrl ? (
            <a
              href={flightBookingUrl}
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
                {liveQuoteCaption(
                  "flight",
                  flightQuote?.source,
                  flightQuote?.withinBand
                )}
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
                {liveQuoteCaption(
                  "hotel",
                  hotelQuote?.source,
                  hotelQuote?.withinBand
                )}
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
            ) : plan.routeOptimization?.applied ? (
              <span className="ml-auto rounded-full bg-brand/10 px-2.5 py-1 text-2xs font-bold text-brand">
                GA 동선 최적화
                {plan.routeOptimization.savedKm >= 0.1
                  ? ` · −${plan.routeOptimization.savedKm.toFixed(1)}km`
                  : ""}
              </span>
            ) : null}
          </div>
          {plan.routeOptimization?.applied ? (
            <p className="mb-3 text-xs leading-relaxed text-ink-caption">
              유전 알고리즘으로 같은 날 장소를 이동 거리가 짧은 순서로 재배치했어요.
              ({plan.routeOptimization.totalKmBefore.toFixed(1)}km →{" "}
              {plan.routeOptimization.totalKmAfter.toFixed(1)}km)
            </p>
          ) : null}
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
          </>
        )}

        <div className="flex flex-col gap-3">
          {!isUnrealistic ? (
            <PrimaryButton onClick={handleSave}>이 일정 저장하기</PrimaryButton>
          ) : null}
          <PrimaryButton variant="secondary" onClick={() => router.push("/")}>
            홈으로 돌아가기
          </PrimaryButton>
        </div>

        {plan.ragSources?.length > 0 && (
          <RagSourcesSection sources={plan.ragSources} />
        )}
      </div>
    </MobileShell>
  );
}

function RagSourcesSection({
  sources,
}: {
  sources: TripRecommendation["ragSources"];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
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
      {expanded ? (
        <div className="flex flex-col gap-2.5">
          {sources.map((source) => (
            <RagSourceCard key={source.id} source={source} />
          ))}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={[
          "w-full rounded-xl border border-line-soft bg-surface-base py-2.5 text-sm font-bold text-brand transition-colors active:bg-surface-soft",
          expanded ? "mt-3" : "",
        ].join(" ")}
      >
        {expanded ? "접기" : `더보기 · ${sources.length}개`}
      </button>
    </section>
  );
}

function RagSourceCard({
  source,
}: {
  source: TripRecommendation["ragSources"][number];
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-surface-base px-3.5 py-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-2xs font-bold text-brand">
          {source.category}
        </span>
        <span className="text-xs font-extrabold text-ink-heading">
          {source.title}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-ink-body">{source.content}</p>
    </div>
  );
}
