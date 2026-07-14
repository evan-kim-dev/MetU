"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  BookOpen,
  CalendarDays,
  MapPin,
  Pencil,
  Plane,
  Sparkles,
  SquareArrowOutUpRight,
  Wallet,
  X,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { DestinationImage } from "@/components/ui/DestinationImage";
import { AIInsightBadge } from "@/components/ui/AIInsightBadge";
import { AILoadingPanel } from "@/components/ui/AILoadingPanel";
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

type FlightOverride = { price: number; airline: string };
type HotelOverride = { price: number; name: string };

function parseWonInput(value: string): number {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function priceCaption(params: {
  kind: "flight" | "hotel";
  overridden: boolean;
  source: "live" | "estimate" | "city-estimate" | undefined;
  withinBand: boolean | undefined;
  loading: boolean;
  people: number;
}): string {
  const { kind, overridden, source, withinBand, loading, people } = params;
  if (overridden) return "직접 입력가 · 예산 분배에 반영됨";
  if (loading) return "시세 조회 중…";
  if (kind === "flight") {
    if (source === "live") {
      const band =
        withinBand === false ? " · 예산 밴드(45%) 초과" : "";
      return `Google Flights 실시간 최저가${band} · ${people}인 합계`;
    }
    return "예상가 · 시세 조회 실패 · Google Flights에서 확인";
  }
  if (source === "live") {
    const band = withinBand === false ? " · 예산 밴드(40%) 초과" : "";
    return `Hotelbeds 실시간 최저가${band} · ${people}인 기준`;
  }
  if (source === "city-estimate") {
    return "도시 시세 추정가 · Hotelbeds 테스트에 해당 지역 재고 없음 · Google Hotels 확인";
  }
  return "예상가 · 시세 조회 실패 · Agoda에서 확인";
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
  const [enrichNotice, setEnrichNotice] = useState<"fallback" | "error" | null>(
    null
  );
  const [routeOptimizing, setRouteOptimizing] = useState(false);
  const routeOptimizeAttemptedRef = useRef<Set<string>>(new Set());
  const {
    flightQuote,
    hotelQuote,
    flightQuoteLoading,
    hotelQuoteLoading,
  } = usePlanQuotes(plan);

  const [flightOverride, setFlightOverride] = useState<FlightOverride | null>(
    null
  );
  const [hotelOverride, setHotelOverride] = useState<HotelOverride | null>(null);
  const [editingFlight, setEditingFlight] = useState(false);
  const [editingHotel, setEditingHotel] = useState(false);
  const [flightDraftPrice, setFlightDraftPrice] = useState("");
  const [flightDraftAirline, setFlightDraftAirline] = useState("");
  const [hotelDraftPrice, setHotelDraftPrice] = useState("");
  const [hotelDraftName, setHotelDraftName] = useState("");

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
    setEnrichNotice(null);
    routeOptimizeAttemptedRef.current.clear();
    setFlightOverride(null);
    setHotelOverride(null);
    setEditingFlight(false);
    setEditingHotel(false);
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
    setEnrichNotice(null);

    void fetch("/api/onboarding/enrich-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form: initialPlan.form, plan: initialPlan }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("enrich-failed");
        return (await res.json()) as {
          plan?: TripRecommendation;
          scheduleSource?: "ai" | "fallback";
        };
      })
      .then((data) => {
        if (cancelled || !data.plan) return;
        setPlan(data.plan);
        if (data.scheduleSource === "fallback" || data.plan.aiScheduleSource === "fallback") {
          setEnrichNotice("fallback");
        }
      })
      .catch(() => {
        if (!cancelled) setEnrichNotice("error");
      })
      .finally(() => {
        if (!cancelled) setEnriching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enrich, initialPlan.id]); // eslint-disable-line react-hooks/exhaustive-deps -- 동일 일정 1회 보강

  // 동선 GA: enrich 전·후에도 실명 POI 기준 재최적화 (동일 일정은 1회만)
  useEffect(() => {
    if (isUnrealistic) return;
    if (plan.routeOptimization?.applied) return;

    const fingerprint = plan.dailySchedule
      .map((d) => `${d.day}:${d.items.map((i) => i.title).join("|")}`)
      .join("||");
    const key = `${plan.id}::${fingerprint}`;
    if (routeOptimizeAttemptedRef.current.has(key)) return;
    routeOptimizeAttemptedRef.current.add(key);

    let cancelled = false;
    setRouteOptimizing(true);

    void fetch("/api/route/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailySchedule: plan.dailySchedule,
        destination: plan.destination,
        country: plan.country,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("route-optimize-failed");
        return (await res.json()) as {
          dailySchedule?: TripRecommendation["dailySchedule"];
          routeOptimization?: TripRecommendation["routeOptimization"];
        };
      })
      .then((data) => {
        if (cancelled || !data.dailySchedule) return;
        setPlan((prev) => ({
          ...prev,
          dailySchedule: data.dailySchedule!,
          routeOptimization: data.routeOptimization ?? prev.routeOptimization,
          tips:
            data.routeOptimization?.applied &&
            !prev.tips.some((t) => t.includes("유전 알고리즘"))
              ? [
                  "유전 알고리즘으로 하루 동선을 재배치해 이동을 줄였어요.",
                  ...prev.tips,
                ].slice(0, 10)
              : prev.tips,
        }));
      })
      .catch(() => {
        // 최적화 실패 시 기존 일정 유지
      })
      .finally(() => {
        if (!cancelled) setRouteOptimizing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isUnrealistic,
    plan.id,
    plan.destination,
    plan.country,
    plan.dailySchedule,
    plan.routeOptimization?.applied,
  ]);

  const flightBookingUrl =
    flightQuote?.googleFlightsUrl ??
    buildGoogleFlightsUrlFromPlan(plan) ??
    undefined;
  const agodaHotelUrl =
    (hotelQuote?.agodaUrl ? hotelQuote.agodaUrl : null) ??
    buildAgodaHotelUrlFromPlan(plan) ??
    undefined;

  const baseFlightPrice = flightQuote?.priceKrw ?? plan.flight.price;
  const baseFlightAirline = flightQuote?.airline ?? plan.flight.airline;
  const baseHotelPrice = hotelQuote?.priceKrw ?? plan.hotel.total;
  const baseHotelName = hotelQuote?.name ?? plan.hotel.name;

  const flightPrice = flightOverride?.price ?? baseFlightPrice;
  const flightAirline = flightOverride?.airline ?? baseFlightAirline;
  const flightRoute = flightQuote?.route ?? plan.flight.route;
  const flightSchedule = flightQuote?.schedule ?? plan.flight.schedule;
  const hotelName = hotelOverride?.name ?? baseHotelName;
  const hotelArea = hotelQuote?.area ?? plan.hotel.area;
  const hotelPrice = hotelOverride?.price ?? baseHotelPrice;
  const hotelNights = plan.hotel.nights || plan.nights;
  const hotelPricePerNight = Math.round(
    hotelPrice / Math.max(1, hotelNights)
  );
  const hotelNightsLabel = `${hotelNights}박 · 1박 ${formatKRW(hotelPricePerNight)}`;

  const liveBudget = useMemo(() => {
    const hasOverride = Boolean(flightOverride || hotelOverride);
    const hasLive =
      flightQuote?.source === "live" ||
      hotelQuote?.source === "live" ||
      hotelQuote?.source === "city-estimate";
    if (!hasOverride && !hasLive) {
      return {
        items: plan.budgetAllocation,
        remaining: plan.totalBudget - plan.flight.price - plan.hotel.total,
        overBudget: false,
        adjusted: false,
        mode: "none" as const,
      };
    }
    const result = reallocateBudgetWithLiveQuotes(
      plan.budgetAllocation,
      plan.totalBudget,
      flightPrice,
      hotelPrice
    );
    return {
      ...result,
      adjusted: true,
      mode: hasOverride ? ("override" as const) : ("live" as const),
    };
  }, [
    plan.budgetAllocation,
    plan.totalBudget,
    plan.flight.price,
    plan.hotel.total,
    flightQuote?.source,
    hotelQuote?.source,
    flightOverride,
    hotelOverride,
    flightPrice,
    hotelPrice,
  ]);

  const openFlightEdit = () => {
    setFlightDraftPrice(String(flightPrice));
    setFlightDraftAirline(flightAirline);
    setEditingFlight(true);
  };

  const applyFlightEdit = () => {
    const price = parseWonInput(flightDraftPrice);
    const airline = flightDraftAirline.trim() || baseFlightAirline;
    if (price <= 0) return;
    setFlightOverride({ price, airline });
    setEditingFlight(false);
  };

  const clearFlightOverride = () => {
    setFlightOverride(null);
    setEditingFlight(false);
  };

  const openHotelEdit = () => {
    setHotelDraftPrice(String(hotelPrice));
    setHotelDraftName(hotelName);
    setEditingHotel(true);
  };

  const applyHotelEdit = () => {
    const price = parseWonInput(hotelDraftPrice);
    const name = hotelDraftName.trim() || baseHotelName;
    if (price <= 0) return;
    setHotelOverride({ price, name });
    setEditingHotel(false);
  };

  const clearHotelOverride = () => {
    setHotelOverride(null);
    setEditingHotel(false);
  };

  const budgetExceeded =
    liveBudget.overBudget || flightPrice + hotelPrice > plan.totalBudget;

  const handleSave = async () => {
    if (budgetExceeded) return;
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
          <AILoadingPanel
            title="AI가 맞춤 일정을 다듬는 중"
            description="웹 지식·예산 RAG로 일정·항공·숙소를 맞추고 있어요"
          />
        ) : null}

        {enrichNotice && !enriching ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl2 border border-amber-200/80 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              {enrichNotice === "error"
                ? "AI 보강에 잠시 실패했어요. 지금은 기본 일정을 보여주고 있어요."
                : "AI 일정 생성은 생략되고, 지식 기반 기본 일정으로 보여드려요."}
            </p>
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
                {liveBudget.mode === "override"
                  ? "직접 입력가 반영"
                  : "실시간가 반영"}
              </span>
            ) : null}
          </div>
          {liveBudget.overBudget ? (
            <p className="mb-3 rounded-xl2 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
              항공·숙소 금액만으로 이미 총예산을{" "}
              {formatKRW(Math.abs(liveBudget.remaining))} 초과해요. 날짜·인원·목적지를
              조정하거나 예산을 올려 보세요.
            </p>
          ) : liveBudget.adjusted ? (
            <p className="mb-3 text-xs leading-relaxed text-ink-caption">
              항공·숙소는{" "}
              {liveBudget.mode === "override" ? "직접 입력가" : "실시간 시세"}로
              고정하고, 남은 {formatKRW(Math.max(0, liveBudget.remaining))}을
              식비·교통·관광에 다시 나눴어요.
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={editingFlight ? () => setEditingFlight(false) : openFlightEdit}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-caption transition-colors hover:bg-surface-soft active:bg-surface-base"
                aria-label={editingFlight ? "항공 수정 닫기" : "항공 가격 수정"}
              >
                {editingFlight ? (
                  <X className="h-4 w-4" strokeWidth={2.2} />
                ) : (
                  <Pencil className="h-4 w-4" strokeWidth={2.2} />
                )}
              </button>
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
          </div>

          {editingFlight ? (
            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ink-caption">항공사</span>
                <input
                  value={flightDraftAirline}
                  onChange={(e) => setFlightDraftAirline(e.target.value)}
                  className="w-full rounded-lg border border-line-soft bg-surface-white px-3 py-2.5 text-sm text-ink-body focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  placeholder="예: 제주항공"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ink-caption">
                  총 항공비 (원, {plan.people}인 합계)
                </span>
                <input
                  inputMode="numeric"
                  value={flightDraftPrice}
                  onChange={(e) => setFlightDraftPrice(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full rounded-lg border border-line-soft bg-surface-white px-3 py-2.5 text-sm text-ink-body focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  placeholder="예: 580000"
                />
              </label>
              <div className="flex gap-2">
                <PrimaryButton className="flex-1" onClick={applyFlightEdit}>
                  적용
                </PrimaryButton>
                {flightOverride ? (
                  <PrimaryButton
                    className="flex-1"
                    variant="secondary"
                    onClick={clearFlightOverride}
                  >
                    원래 가격
                  </PrimaryButton>
                ) : null}
              </div>
            </div>
          ) : (
            <>
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
                  {flightQuoteLoading && !flightOverride ? (
                    <div className="h-7 w-28 animate-pulse rounded-md bg-surface-soft" />
                  ) : (
                    <p className="text-lg font-extrabold text-brand">
                      {formatKRW(flightPrice)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink-caption">
                    {priceCaption({
                      kind: "flight",
                      overridden: Boolean(flightOverride),
                      source: flightQuote?.source,
                      withinBand: flightQuote?.withinBand,
                      loading: flightQuoteLoading,
                      people: plan.people,
                    })}
                  </p>
                </a>
              ) : (
                <>
                  <p className="mt-2 text-lg font-extrabold text-brand">
                    {formatKRW(flightPrice)}
                  </p>
                  <p className="mt-1 text-xs text-ink-caption">
                    {priceCaption({
                      kind: "flight",
                      overridden: Boolean(flightOverride),
                      source: flightQuote?.source,
                      withinBand: flightQuote?.withinBand,
                      loading: flightQuoteLoading,
                      people: plan.people,
                    })}
                  </p>
                </>
              )}
              <p className="mt-1 text-xs text-ink-caption">{plan.flight.note}</p>
              <button
                type="button"
                onClick={openFlightEdit}
                className="mt-3 text-xs font-bold text-brand"
              >
                가격이 이상하면 직접 수정
              </button>
            </>
          )}
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={editingHotel ? () => setEditingHotel(false) : openHotelEdit}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-caption transition-colors hover:bg-surface-soft active:bg-surface-base"
                aria-label={editingHotel ? "숙소 수정 닫기" : "숙소 가격 수정"}
              >
                {editingHotel ? (
                  <X className="h-4 w-4" strokeWidth={2.2} />
                ) : (
                  <Pencil className="h-4 w-4" strokeWidth={2.2} />
                )}
              </button>
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
          </div>

          {editingHotel ? (
            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ink-caption">숙소명</span>
                <input
                  value={hotelDraftName}
                  onChange={(e) => setHotelDraftName(e.target.value)}
                  className="w-full rounded-lg border border-line-soft bg-surface-white px-3 py-2.5 text-sm text-ink-body focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  placeholder="예: Marina Bay 호텔"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ink-caption">
                  숙소 총액 (원, {hotelNights}박)
                </span>
                <input
                  inputMode="numeric"
                  value={hotelDraftPrice}
                  onChange={(e) => setHotelDraftPrice(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full rounded-lg border border-line-soft bg-surface-white px-3 py-2.5 text-sm text-ink-body focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  placeholder="예: 720000"
                />
              </label>
              <div className="flex gap-2">
                <PrimaryButton className="flex-1" onClick={applyHotelEdit}>
                  적용
                </PrimaryButton>
                {hotelOverride ? (
                  <PrimaryButton
                    className="flex-1"
                    variant="secondary"
                    onClick={clearHotelOverride}
                  >
                    원래 가격
                  </PrimaryButton>
                ) : null}
              </div>
            </div>
          ) : (
            <>
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
                  {hotelQuoteLoading && !hotelOverride ? (
                    <div className="h-7 w-28 animate-pulse rounded-md bg-surface-soft" />
                  ) : (
                    <p className="text-lg font-extrabold text-brand">
                      {formatKRW(hotelPrice)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink-caption">
                    {priceCaption({
                      kind: "hotel",
                      overridden: Boolean(hotelOverride),
                      source: hotelQuote?.source,
                      withinBand: hotelQuote?.withinBand,
                      loading: hotelQuoteLoading,
                      people: plan.people,
                    })}
                  </p>
                </a>
              ) : (
                <>
                  <p className="mt-1 text-lg font-extrabold text-brand">
                    {formatKRW(hotelPrice)}
                  </p>
                  <p className="mt-1 text-xs text-ink-caption">
                    {priceCaption({
                      kind: "hotel",
                      overridden: Boolean(hotelOverride),
                      source: hotelQuote?.source,
                      withinBand: hotelQuote?.withinBand,
                      loading: hotelQuoteLoading,
                      people: plan.people,
                    })}
                  </p>
                </>
              )}
              <p className="mt-1 text-xs text-ink-caption">{plan.hotel.note}</p>
              <button
                type="button"
                onClick={openHotelEdit}
                className="mt-3 text-xs font-bold text-brand"
              >
                가격이 이상하면 직접 수정
              </button>
            </>
          )}
        </section>

        <section className="rounded-xl2 bg-surface-white p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-extrabold text-ink-heading">일정표</h3>
            {enriching || routeOptimizing ? (
              <span className="ml-auto text-xs font-semibold text-brand">
                {enriching ? "AI 다듬는 중" : "동선 최적화 중"}
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
                        <p className="text-sm font-bold text-ink-heading">
                          {item.title}
                        </p>
                        {item.detail ? (
                          <p className="mt-0.5 text-sm leading-snug text-ink-body">
                            {item.detail}
                          </p>
                        ) : null}
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
          {!isUnrealistic && !budgetExceeded ? (
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
