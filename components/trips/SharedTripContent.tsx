"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Users, Wallet } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { BudgetDonutChart } from "@/components/recommend/BudgetDonutChart";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatKRW } from "@/lib/mock/home";
import { STYLE_LABELS } from "@/lib/trips/data";
import {
  buildSharedTripUrl,
  cloneSharedTripForAdd,
  fetchSharedTrip,
} from "@/lib/trips/share";
import { useTrips } from "@/lib/trips/TripProvider";
import type { Trip } from "@/lib/trips/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface SharedTripContentProps {
  token: string;
}

export function SharedTripContent({ token }: SharedTripContentProps) {
  const router = useRouter();
  const { user, provider } = useAuth();
  const { addTrip } = useTrips();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        if (mounted) {
          setError("공유 여행을 불러올 수 없어요.");
          setLoading(false);
        }
        return;
      }

      const shared = await fetchSharedTrip(supabase, token);
      if (!mounted) return;

      if (!shared) {
        setError("공유 링크가 만료되었거나 존재하지 않아요.");
      } else {
        setTrip(shared);
      }
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [token]);

  const styleLabels = useMemo(
    () => trip?.styles.map((style) => STYLE_LABELS[style] ?? style) ?? [],
    [trip?.styles]
  );

  async function handleAddToMyTrips() {
    if (!trip || adding) return;

    if (!user || provider === "guest") {
      router.push(`/login?next=${encodeURIComponent(`/trips/share/${token}`)}`);
      return;
    }

    setAdding(true);
    const cloned = cloneSharedTripForAdd(trip);
    const saved = await addTrip(cloned);
    setAdding(false);
    router.push(`/trips/${saved.id}`);
  }

  if (loading) {
    return (
      <MobileShell title="공유 여행" showBack backHref="/">
        <div className="px-5 pt-5">
          <div className="h-56 animate-pulse rounded-xl2 bg-surface-soft" />
        </div>
      </MobileShell>
    );
  }

  if (!trip) {
    return (
      <MobileShell title="공유 여행" showBack backHref="/">
        <div className="flex flex-col items-center gap-3 px-5 py-20 text-center">
          <p className="text-base font-bold text-ink-heading">{error}</p>
          <PrimaryButton onClick={() => router.push("/")}>홈으로</PrimaryButton>
        </div>
      </MobileShell>
    );
  }

  const remaining = trip.budget - trip.spent;
  const usedPercent = Math.round((trip.spent / Math.max(trip.budget, 1)) * 100);

  return (
    <MobileShell title="공유 여행" showBack backHref="/" showBottomNav={false}>
      <div className="flex flex-col gap-6 px-5 pb-28 pt-5">
        <div className="rounded-xl2 border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-ink-body">
          친구가 공유한 여행이에요. 내 계정에 추가하면 예산·일정을 그대로
          가져와 수정할 수 있어요.
        </div>

        <div className="relative h-56 overflow-hidden rounded-xl2 shadow-soft">
          <Image
            src={trip.imageUrl}
            alt={`${trip.destination} 여행`}
            fill
            sizes="440px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-surface-white">
            <div className="flex items-center gap-1 text-xs font-semibold opacity-90">
              <MapPin className="h-3.5 w-3.5" />
              {trip.country}
            </div>
            <h2 className="mt-1 text-3xl font-extrabold">{trip.destination}</h2>
            <div className="mt-1 flex items-center gap-1 text-sm opacity-90">
              <CalendarDays className="h-4 w-4" />
              {trip.dateRange}
            </div>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3">
          <InfoCard icon={<Users className="h-4 w-4" />} label="인원" value={`${trip.people}명`} />
          <InfoCard icon={<MapPin className="h-4 w-4" />} label="출발지" value={trip.origin} />
        </section>

        <section className="rounded-xl2 border border-line-soft bg-surface-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-extrabold text-ink-heading">예산</h3>
          </div>
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-medium text-ink-caption">총 예산</p>
              <p className="text-2xl font-extrabold text-ink-heading">
                {formatKRW(trip.budget)}
              </p>
            </div>
            {trip.budgetAllocation && trip.budgetAllocation.length > 0 ? (
              <BudgetDonutChart
                items={trip.budgetAllocation}
                totalBudget={trip.budget}
                people={trip.people}
              />
            ) : null}
            <div className="rounded-xl bg-surface-soft px-3 py-2 text-xs text-ink-caption">
              참고 예산 · 남은 예산 {formatKRW(remaining)} ({usedPercent}% 사용)
            </div>
          </div>
        </section>

        {trip.dailySchedule && trip.dailySchedule.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-extrabold text-ink-heading">일정</h3>
            {trip.dailySchedule.map((day) => (
              <div
                key={day.day}
                className="rounded-xl border border-line-soft bg-surface-base p-4"
              >
                <div className="mb-3">
                  <span className="text-sm font-extrabold text-brand">
                    Day {day.day}
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
                      {item.cost > 0 ? (
                        <span className="shrink-0 text-xs font-bold text-ink-heading">
                          {formatKRW(item.cost)}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {styleLabels.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-extrabold text-ink-heading">여행 스타일</h3>
            <div className="flex flex-wrap gap-2">
              {styleLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-surface-soft px-3 py-1.5 text-sm font-semibold text-brand-strong"
                >
                  {label}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {trip.memo ? (
          <section className="rounded-xl2 border border-line-soft bg-surface-white p-4">
            <h3 className="mb-2 text-lg font-extrabold text-ink-heading">메모</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-body">
              {trip.memo}
            </p>
          </section>
        ) : null}

        {trip.tips && trip.tips.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-lg font-extrabold text-ink-heading">여행 팁</h3>
            <ul className="flex flex-col gap-2">
              {trip.tips.map((tip) => (
                <li
                  key={tip}
                  className="rounded-xl border border-line-soft bg-surface-white px-3 py-2 text-sm text-ink-body"
                >
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-mobile -translate-x-1/2 border-t border-line-soft bg-surface-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <PrimaryButton fullWidth disabled={adding} onClick={() => void handleAddToMyTrips()}>
          {adding ? "추가 중..." : "내 여행에 추가"}
        </PrimaryButton>
        <p className="mt-2 text-center text-[11px] text-ink-caption">
          {buildSharedTripUrl(token).replace(/^https?:\/\//, "")}
        </p>
      </div>
    </MobileShell>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl2 border border-line-soft bg-surface-white p-4">
      <div className="mb-1 flex items-center gap-1.5 text-ink-caption">
        {icon}
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="text-sm font-bold text-ink-heading">{value}</p>
    </div>
  );
}
