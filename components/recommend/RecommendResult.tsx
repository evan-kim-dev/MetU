"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  BookOpen,
  CalendarDays,
  MapPin,
  Plane,
  Wallet,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { AIInsightBadge } from "@/components/ui/AIInsightBadge";
import { BudgetDonutChart } from "@/components/recommend/BudgetDonutChart";
import { formatKRW } from "@/lib/mock/home";
import type { TripRecommendation } from "@/lib/ai/types";
import { DEFAULTS } from "@/lib/constants";
import { useTrips } from "@/lib/trips/TripProvider";
import type { Trip } from "@/lib/trips/types";

function planToTrip(plan: TripRecommendation): Trip {
  const expenses = [
    {
      id: "exp-flight",
      category: "교통",
      label: `${plan.flight.airline} 항공권`,
      amount: plan.flight.price,
      date: "예약 예정",
    },
    {
      id: "exp-hotel",
      category: "숙소",
      label: `${plan.hotel.name} ${plan.hotel.nights}박`,
      amount: plan.hotel.total,
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
    spent: plan.flight.price + plan.hotel.total,
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

  const handleSave = () => {
    const trip = planToTrip(plan);
    addTrip(trip);
    router.push(`/trips/${trip.id}`);
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

        <AIInsightBadge>{plan.summary}</AIInsightBadge>

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
          <div className="mb-3 flex items-center gap-2">
            <Plane className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-extrabold text-ink-heading">항공권</h3>
          </div>
          <p className="font-bold text-ink-heading">{plan.flight.airline}</p>
          <p className="mt-1 text-sm text-ink-body">{plan.flight.route}</p>
          <p className="text-sm text-ink-caption">{plan.flight.schedule}</p>
          <p className="mt-2 text-lg font-extrabold text-brand">
            {formatKRW(plan.flight.price)}
          </p>
          <p className="mt-1 text-xs text-ink-caption">{plan.flight.note}</p>
        </section>

        {/* 숙소 */}
        <section className="rounded-xl2 border border-line-soft bg-surface-white p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-extrabold text-ink-heading">숙소</h3>
          </div>
          <p className="font-bold text-ink-heading">{plan.hotel.name}</p>
          <div className="mt-1 flex items-center gap-1 text-sm text-ink-caption">
            <MapPin className="h-3.5 w-3.5" />
            {plan.hotel.area}
          </div>
          <p className="mt-2 text-sm text-ink-body">
            {plan.hotel.nights}박 · 1박 {formatKRW(plan.hotel.pricePerNight)}
          </p>
          <p className="mt-1 text-lg font-extrabold text-brand">
            {formatKRW(plan.hotel.total)}
          </p>
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
                  <span className="text-xs font-semibold text-ink-caption">
                    {day.label}
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
