"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { StepCard } from "@/components/ui/StepCard";
import { AirportSearchField } from "@/components/onboarding/AirportSearchField";
import {
  formatDestinationForPlan,
  formatPlaceLabel,
} from "@/lib/airports/data";
import { formatMonthDealInsight } from "@/lib/rag/monthDeals";
import { getFlexibleYearOptions } from "./types";
import type { DateType } from "./types";

interface ScheduleStepProps {
  origin: string;
  destination: string;
  dateType: DateType;
  startDate: string;
  endDate: string;
  flexibleYear: number;
  flexibleMonth: number;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onDateTypeChange: (value: DateType) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onFlexibleYearChange: (value: number) => void;
  onFlexibleMonthChange: (value: number) => void;
}

const DATE_OPTIONS = [
  { value: "specific" as const, label: "날짜 지정" },
  { value: "flexible" as const, label: "언제든지" },
];
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEAR_OPTIONS = getFlexibleYearOptions();
const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function localScheduleInsight(params: {
  origin: string;
  destination: string;
  dateType: DateType;
  startDate: string;
  endDate: string;
  flexibleYear: number;
  flexibleMonth: number;
}): string {
  if (params.dateType === "specific") {
    if (params.startDate && params.endDate) {
      const from = params.origin || "출발지";
      const to = params.destination || "목적지";
      return `${from} → ${to}, ${params.startDate}~${params.endDate} 기준으로 항공·숙소 예산을 맞춰 드릴게요.`;
    }
    return "선택한 기간 기반으로 최적 예산 분배를 진행해요.";
  }

  return `${params.flexibleYear}년 ${formatMonthDealInsight(params.flexibleMonth)}`;
}

export function ScheduleStep({
  origin,
  destination,
  dateType,
  startDate,
  endDate,
  flexibleYear,
  flexibleMonth,
  onOriginChange,
  onDestinationChange,
  onDateTypeChange,
  onStartDateChange,
  onEndDateChange,
  onFlexibleYearChange,
  onFlexibleMonthChange,
}: ScheduleStepProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [viewDate, setViewDate] = useState(() => {
    const target = parseIsoDate(startDate);
    return target ?? new Date();
  });
  const [insight, setInsight] = useState(() =>
    localScheduleInsight({
      origin,
      destination,
      dateType,
      startDate,
      endDate,
      flexibleYear,
      flexibleMonth,
    })
  );
  const [loading, setLoading] = useState(false);

  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  const monthCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean }> = [];

    for (let i = startWeekday - 1; i >= 0; i -= 1) {
      cells.push({ date: new Date(year, month, -i), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: new Date(year, month, day), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const next = cells.length - (startWeekday + daysInMonth) + 1;
      cells.push({ date: new Date(year, month + 1, next), inMonth: false });
    }
    return cells;
  }, [viewDate]);

  useEffect(() => {
    const local = localScheduleInsight({
      origin,
      destination,
      dateType,
      startDate,
      endDate,
      flexibleYear,
      flexibleMonth,
    });
    setInsight(local);

    const controller = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(() => {
      fetch("/api/schedule-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          dateType,
          startDate,
          endDate,
          flexibleYear,
          flexibleMonth,
        }),
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("schedule-insight-failed");
          return (await res.json()) as { insight?: string };
        })
        .then((data) => {
          if (data.insight?.trim()) setInsight(data.insight.trim());
        })
        .catch((error) => {
          if ((error as Error)?.name === "AbortError") return;
          setInsight(local);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    origin,
    destination,
    dateType,
    startDate,
    endDate,
    flexibleYear,
    flexibleMonth,
  ]);

  const handlePickDate = (date: Date) => {
    const iso = toIsoDate(date);
    if (!start || (start && end)) {
      onStartDateChange(iso);
      onEndDateChange("");
      return;
    }
    if (date < start) {
      onStartDateChange(iso);
      onEndDateChange("");
      return;
    }
    onEndDateChange(iso);
  };

  const isInRange = (date: Date) => {
    if (!start || !end) return false;
    const t = date.getTime();
    return t > start.getTime() && t < end.getTime();
  };

  const isStartOrEnd = (date: Date) => {
    const iso = toIsoDate(date);
    return iso === startDate || iso === endDate;
  };

  return (
    <StepCard
      title="언제, 어디로 떠나나요?"
      subtitle="출발지와 목적지, 원하는 일정 방식을 알려주세요."
    >
      <div className="relative flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <AirportSearchField
            label="출발지"
            placeholder="예: 서울"
            value={origin}
            onChange={onOriginChange}
            formatValue={formatPlaceLabel}
          />
          <div className="relative z-10 -my-1 flex justify-center">
            <button
              type="button"
              aria-label="출발지와 목적지 바꾸기"
              onClick={() => {
                onOriginChange(destination);
                onDestinationChange(origin);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line-muted bg-surface-white text-ink-body shadow-sm transition-colors active:bg-surface-soft"
            >
              <ArrowLeftRight className="h-4 w-4 rotate-90" strokeWidth={2.3} />
            </button>
          </div>
          <AirportSearchField
            label="도착지"
            placeholder="어디든지"
            value={destination}
            onChange={onDestinationChange}
            formatValue={(place) =>
              place.kind === "city"
                ? formatDestinationForPlan(place)
                : `${place.city} · ${formatPlaceLabel(place)}`
            }
          />
        </div>
        <p className="text-xs text-ink-caption">
          도시(모두) 또는 공항을 고르면 AI가 항공 구간을 더 정확히 맞춰요.
        </p>
      </div>

      <section className="flex w-full flex-col gap-4 rounded-xl border border-line-soft bg-surface-white p-4 shadow-soft">
        <div className="flex w-full items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10">
            <CalendarDays className="h-4 w-4 text-brand" strokeWidth={2.2} />
          </span>
          <h3 className="text-lg font-extrabold text-ink-heading">여행 날짜</h3>
        </div>

        <div className="w-full rounded-xl bg-line-soft p-1">
          <div className="grid grid-cols-2 gap-1">
            {DATE_OPTIONS.map((option) => {
              const active = dateType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onDateTypeChange(option.value)}
                  className={[
                    "h-8 rounded-lg text-sm font-semibold tracking-wide transition-colors",
                    active
                      ? "bg-surface-white text-brand shadow-sm"
                      : "text-ink-body",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {dateType === "specific" ? (
          <>
            <div className="w-full rounded-xl border border-line-muted bg-surface-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="이전 달"
                  className="rounded-md p-1 text-ink-body active:bg-surface-soft"
                  onClick={() =>
                    setViewDate(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-ink-heading">
                  {formatMonthLabel(viewDate)}
                </span>
                <button
                  type="button"
                  aria-label="다음 달"
                  className="rounded-md p-1 text-ink-body active:bg-surface-soft"
                  onClick={() =>
                    setViewDate(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1">
                {WEEK_DAYS.map((day, idx) => (
                  <span
                    key={day}
                    className={`text-center text-xs ${
                      idx === 0
                        ? "text-danger"
                        : idx === 6
                          ? "text-brand"
                          : "text-ink-caption"
                    }`}
                  >
                    {day}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {monthCells.map(({ date, inMonth }) => {
                  const selected = isStartOrEnd(date);
                  const ranged = isInRange(date);
                  return (
                    <button
                      key={toIsoDate(date)}
                      type="button"
                      disabled={!inMonth}
                      onClick={() => handlePickDate(date)}
                      className={[
                        "h-9 rounded-full text-sm font-medium transition-colors",
                        !inMonth ? "text-line-muted" : "text-ink-heading",
                        selected
                          ? "bg-brand text-surface-white"
                          : ranged
                            ? "bg-brand/20 text-ink-heading"
                            : "hover:bg-surface-soft",
                      ].join(" ")}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="w-full grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="h-11 rounded-lg border border-line-muted bg-surface-white px-3 text-sm text-ink-heading focus:border-brand focus:outline-none"
              />
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="h-11 rounded-lg border border-line-muted bg-surface-white px-3 text-sm text-ink-heading focus:border-brand focus:outline-none"
              />
            </div>
          </>
        ) : (
          <div className="w-full flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-ink-caption">연도</span>
              <div className="grid grid-cols-3 gap-2">
                {YEAR_OPTIONS.map((year) => {
                  const active = year === flexibleYear;
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => onFlexibleYearChange(year)}
                      className={[
                        "rounded-lg px-2 py-2 text-sm font-bold transition-colors",
                        active
                          ? "bg-brand text-surface-white"
                          : "border border-line-muted bg-surface-base text-ink-caption",
                      ].join(" ")}
                    >
                      {year}년
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-ink-caption">월</span>
              <div className="grid grid-cols-4 gap-2">
                {MONTH_OPTIONS.map((month) => {
                  const active = month === flexibleMonth;
                  const isPast =
                    flexibleYear === currentYear && month < currentMonth;
                  return (
                    <button
                      key={month}
                      type="button"
                      disabled={isPast}
                      onClick={() => onFlexibleMonthChange(month)}
                      className={[
                        "rounded-lg px-2 py-2 text-sm font-bold transition-colors",
                        isPast
                          ? "cursor-not-allowed border border-line-soft bg-surface-soft text-line-muted"
                          : active
                            ? "bg-brand text-surface-white"
                            : "border border-line-muted bg-surface-base text-ink-caption",
                      ].join(" ")}
                    >
                      {month}월
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="w-full">
          <div className="inline-flex max-w-full items-start gap-1.5 rounded-2xl bg-brand/10 px-3 py-2 text-xs leading-relaxed text-brand">
            <Sparkles
              className={[
                "mt-0.5 h-3.5 w-3.5 shrink-0",
                loading ? "animate-pulse" : "",
              ].join(" ")}
              strokeWidth={2.3}
            />
            <span>{insight}</span>
          </div>
        </div>
      </section>
    </StepCard>
  );
}
