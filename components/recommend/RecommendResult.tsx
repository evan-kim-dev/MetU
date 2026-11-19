"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Pencil, Sparkles } from "lucide-react";
import {
  CostPill,
  DayTab,
  PrimaryFooter,
  ScreenHeader,
} from "@/components/ds";
import { AILoadingPanel } from "@/components/ui/AILoadingPanel";
import { EasterEggCelebration } from "@/components/ui/EasterEggCelebration";
import { usePlanQuotes } from "@/components/recommend/usePlanQuotes";
import { formatKRW } from "@/lib/shared/format";
import { planHasEasterEgg } from "@/lib/ai/plan-easter-egg";
import { reallocateBudgetWithLiveQuotes } from "@/lib/ai/realloc-budget";
import type { TripRecommendation } from "@/lib/ai/types";
import { useTrips } from "@/lib/trips/TripProvider";
import { planToTrip } from "@/components/recommend/planToTrip";
import { planEstimateKrw } from "@/lib/ledger/plan-estimate";
import { cn } from "@/lib/design/tokens";

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
  /**
   * true면 FX 배지에 VERIFY 예시(+2.5%)를 명시 적용.
   * 1초 데모·샘플 직행용. 일반 온보딩은 수수료 미설정(0).
   */
  demoFxExample?: boolean;
}

export function RecommendResult({
  plan: initialPlan,
  enrich = false,
  demoFxExample: _demoFxExample = false,
}: RecommendResultProps) {
  const router = useRouter();
  const { addTrip } = useTrips();
  const [plan, setPlan] = useState(initialPlan);
  const [enriching, setEnriching] = useState(enrich);
  const [enrichNotice, setEnrichNotice] = useState<"fallback" | "error" | null>(
    null
  );
  const [routeOptimizeNotice, setRouteOptimizeNotice] = useState(false);
  const [routeOptimizing, setRouteOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() =>
    String(initialPlan.dailySchedule[0]?.day ?? 1)
  );
  const routeOptimizeAttemptedRef = useRef<Set<string>>(new Set());
  const routeOptimizeInflightRef = useRef(false);
  const { flightQuote, hotelQuote } = usePlanQuotes(plan);

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
    setSelectedDay(String(initialPlan.dailySchedule[0]?.day ?? 1));
  }, [initialPlan.id, enrich]); // eslint-disable-line react-hooks/exhaustive-deps -- 새 폴백만 동기화

  useEffect(() => {
    if (!planHasEasterEgg(initialPlan)) {
      setShowEasterCelebration(false);
      return;
    }
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
        if (
          data.scheduleSource === "fallback" ||
          data.plan.aiScheduleSource === "fallback"
        ) {
          setEnrichNotice("fallback");
        }
        const first = data.plan.dailySchedule[0]?.day;
        if (first != null) setSelectedDay(String(first));
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

  useEffect(() => {
    if (isUnrealistic) return;
    if (enriching) return;
    if (plan.routeOptimization?.applied) return;
    if (routeOptimizeInflightRef.current) return;

    const fingerprint = plan.dailySchedule
      .map((d) => `${d.day}:${d.items.map((i) => i.title).join("|")}`)
      .join("||");
    const key = `${plan.id}::${fingerprint}`;
    if (routeOptimizeAttemptedRef.current.has(key)) return;
    routeOptimizeAttemptedRef.current.add(key);

    let cancelled = false;
    routeOptimizeInflightRef.current = true;
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
        if (!cancelled) setRouteOptimizeNotice(true);
      })
      .finally(() => {
        routeOptimizeInflightRef.current = false;
        if (!cancelled) setRouteOptimizing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isUnrealistic,
    enriching,
    plan.id,
    plan.destination,
    plan.country,
    plan.dailySchedule,
    plan.routeOptimization?.applied,
  ]);

  const flightPrice = flightQuote?.priceKrw ?? plan.flight.price;
  const flightAirline = flightQuote?.airline ?? plan.flight.airline;
  const hotelPrice = hotelQuote?.priceKrw ?? plan.hotel.total;
  const hotelName = hotelQuote?.name ?? plan.hotel.name;

  const liveBudget = useMemo(() => {
    const hasLive =
      flightQuote?.source === "live" ||
      hotelQuote?.source === "live" ||
      hotelQuote?.source === "city-estimate";
    if (!hasLive) {
      return {
        remaining: plan.totalBudget - plan.flight.price - plan.hotel.total,
        overBudget: false,
      };
    }
    const result = reallocateBudgetWithLiveQuotes(
      plan.budgetAllocation,
      plan.totalBudget,
      flightPrice,
      hotelPrice
    );
    return {
      remaining: result.remaining,
      overBudget: result.overBudget,
    };
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

  const scheduleEstimate =
    planEstimateKrw({
      dailySchedule: plan.dailySchedule,
      budgetAllocation: plan.budgetAllocation,
    }) ?? 0;
  const plannedTotal = scheduleEstimate + flightPrice + hotelPrice;
  const slack = plan.totalBudget - plannedTotal;
  const budgetExceeded =
    liveBudget.overBudget || flightPrice + hotelPrice > plan.totalBudget;

  const dayTabs = plan.dailySchedule.map((d) => ({
    key: String(d.day),
    label: `${d.day}일차`,
  }));

  const activeDay =
    plan.dailySchedule.find((d) => String(d.day) === selectedDay) ??
    plan.dailySchedule[0];

  const handleSave = async () => {
    if (budgetExceeded || saving) return;
    setSaving(true);
    try {
      const trip = planToTrip(
        plan,
        flightPrice,
        flightAirline,
        hotelPrice,
        hotelName
      );
      const saved = await addTrip(trip);
      router.push(`/trips/${saved.id}`);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-mu-bg">
      <EasterEggCelebration
        open={showEasterCelebration}
        destination={plan.destination}
        onClose={closeEasterCelebration}
      />

      <ScreenHeader
        left={
          <button
            type="button"
            onClick={() => router.push("/onboarding")}
            aria-label="뒤로"
            className="mu-focus flex h-11 w-11 items-center justify-center rounded-mu-md text-mu-fg"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        }
        center={
          <div className="min-w-0 text-center">
            <p className="truncate text-mu-body font-semibold text-mu-fg">
              {plan.destination}
            </p>
            <p className="truncate text-mu-caption text-mu-fg-3">
              {plan.dateRange}
              {plan.nights > 0 ? ` · ${plan.nights}박` : ""}
            </p>
          </div>
        }
        right={
          <button
            type="button"
            onClick={() => router.push("/onboarding")}
            className="mu-focus flex min-h-tap items-center gap-1 rounded-mu-md px-2 text-mu-label font-semibold text-mu-accent"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            수정
          </button>
        }
      />

      <div className="flex flex-col gap-5 px-5 pb-36 pt-5">
        {enriching ? (
          <AILoadingPanel
            title="AI가 맞춤 일정을 다듬는 중"
            description="웹 지식·예산 RAG로 일정·항공·숙소를 맞추고 있어요"
          />
        ) : null}

        {enrichNotice && !enriching ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-mu-lg border border-mu-warn/30 bg-mu-warn-soft px-3.5 py-2.5 text-mu-body text-mu-warn"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              {enrichNotice === "error"
                ? "AI 보강에 잠시 실패했어요. 지금은 기본 일정을 보여주고 있어요."
                : "AI 일정 생성은 생략되고, 지식 기반 기본 일정으로 보여드려요."}
            </p>
          </div>
        ) : null}

        {routeOptimizeNotice && !routeOptimizing ? (
          <p className="text-mu-caption text-mu-fg-3">
            동선 자동 최적화는 건너뛰었어요. 일정 순서는 그대로예요.
          </p>
        ) : null}

        {isEasterEgg ? (
          <p className="rounded-mu-lg bg-mu-accent-soft px-3 py-2 text-mu-body text-mu-accent-strong">
            {plan.summary}
          </p>
        ) : null}

        <section
          className={cn(
            "rounded-mu-xl border px-4 py-4",
            slack >= 0
              ? "border-mu-ok/30 bg-mu-ok-soft"
              : "border-mu-err/30 bg-mu-err-soft"
          )}
          aria-label="예산 여유"
        >
          <p className="text-mu-caption font-medium text-mu-fg-2">예산 상태</p>
          <p className="mu-num mt-1 text-xl font-bold text-mu-fg">
            {slack >= 0
              ? `여유 ${formatKRW(slack)}`
              : `초과 ${formatKRW(Math.abs(slack))}`}
          </p>
          <p className="mt-1 text-mu-caption text-mu-fg-3">
            계획 합 {formatKRW(plannedTotal)} · 총예산{" "}
            {formatKRW(plan.totalBudget)}
          </p>
        </section>

        {isUnrealistic ? (
          <section className="rounded-mu-xl border border-mu-line bg-mu-card p-5">
            <p className="text-mu-body leading-relaxed text-mu-fg-2">
              지금은 현실적인 일정을 만들기 어려워요. 예산을 올리거나 인원·목적지를
              바꾼 뒤 다시 추천받아 보세요.
            </p>
          </section>
        ) : (
          <>
            {(enriching || routeOptimizing) && (
              <p className="text-mu-caption font-semibold text-mu-accent">
                {enriching ? "AI 다듬는 중…" : "동선 최적화 중…"}
              </p>
            )}

            {dayTabs.length > 0 ? (
              <DayTab
                items={dayTabs}
                value={selectedDay}
                onChange={setSelectedDay}
                className="px-0"
              />
            ) : null}

            {activeDay ? (
              <ol className="relative flex flex-col gap-0 border-l-2 border-mu-line pl-4">
                {activeDay.items.map((item) => (
                  <li
                    key={`${activeDay.day}-${item.time}-${item.title}`}
                    className="relative pb-5 last:pb-0"
                  >
                    <span
                      className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-mu-accent"
                      aria-hidden
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-mu-caption font-semibold text-mu-fg-3">
                          {item.time}
                        </p>
                        <p className="mt-0.5 text-mu-body font-semibold text-mu-fg">
                          {item.title}
                        </p>
                        {item.detail ? (
                          <p className="mt-0.5 text-mu-caption leading-snug text-mu-fg-2">
                            {item.detail}
                          </p>
                        ) : null}
                      </div>
                      <CostPill amount={item.cost} unknown={item.cost <= 0} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-mu-body text-mu-fg-3">일정이 아직 없어요.</p>
            )}

            {activeDay ? (
              <p className="text-right text-mu-caption font-semibold text-mu-accent">
                일일 예상 {formatKRW(activeDay.dayTotal)}
              </p>
            ) : null}
          </>
        )}
      </div>

      {!isUnrealistic && !budgetExceeded ? (
        <PrimaryFooter
          label={saving ? "저장 중…" : "이 일정으로 확정하기"}
          onClick={() => {
            void handleSave();
          }}
          loading={saving}
          disabled={saving || enriching}
          secondary={{
            label: "조건 다시 입력하기",
            onClick: () => router.push("/onboarding"),
          }}
        />
      ) : (
        <PrimaryFooter
          label="조건 다시 입력하기"
          onClick={() => router.push("/onboarding")}
        />
      )}
    </div>
  );
}
