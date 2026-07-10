"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CloudSun, MapPin, Sparkles } from "lucide-react";
import { AIInsightBadge } from "@/components/ui/AIInsightBadge";
import { AILoadingPanel } from "@/components/ui/AILoadingPanel";
import { useTrips } from "@/lib/trips/TripProvider";
import { getPrimaryActiveTrip } from "@/lib/checklist/resolve-docs-country";
import {
  fetchTripPeriodWeather,
  fetchWeatherForecast,
  type TripWeatherDay,
  type WeatherForecast,
} from "@/lib/weather/open-meteo";
import { parseTripDateRange } from "@/lib/weather/parse-trip-dates";

interface TripWeatherInsight {
  summary: string;
  preparation: string[];
  source: string;
}

export function WeatherChecklistContent() {
  const { activeTrips, isReady } = useTrips();
  const primaryTrip = useMemo(() => getPrimaryActiveTrip(activeTrips), [activeTrips]);
  const [query, setQuery] = useState("");
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tripDays, setTripDays] = useState<TripWeatherDay[]>([]);
  const [tripInsight, setTripInsight] = useState<TripWeatherInsight | null>(null);
  const [tripDaysLoading, setTripDaysLoading] = useState(false);
  const [tripInsightLoading, setTripInsightLoading] = useState(false);

  const parsedTripDates = useMemo(() => {
    if (!primaryTrip) return null;
    return parseTripDateRange(primaryTrip.dateRange, primaryTrip.dDay);
  }, [primaryTrip]);

  const travelMonth = parsedTripDates
    ? Number(parsedTripDates.startDate.slice(5, 7))
    : null;
  const usesMonthlyClimate = tripDays.some((day) => day.source === "climate");

  useEffect(() => {
    if (!isReady) return;
    setQuery(primaryTrip?.destination ?? "");
  }, [isReady, primaryTrip?.destination]);

  useEffect(() => {
    if (!isReady) return;

    const target = query.trim();
    if (!target) {
      setForecast(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    void (async () => {
      const result = await fetchWeatherForecast(target);
      if (cancelled) return;

      if (!result) {
        setForecast(null);
        setError("날씨 정보를 찾지 못했어요. 도시 이름을 다시 확인해 주세요.");
      } else {
        setForecast(result);
        setError("");
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, query]);

  useEffect(() => {
    if (!isReady || !primaryTrip || !parsedTripDates) {
      setTripDays([]);
      setTripInsight(null);
      setTripDaysLoading(false);
      setTripInsightLoading(false);
      return;
    }

    const target = (query.trim() || primaryTrip.destination).trim();
    if (!target) return;

    let cancelled = false;
    setTripDaysLoading(true);
    setTripInsightLoading(true);
    setTripInsight(null);

    void (async () => {
      const period = await fetchTripPeriodWeather(
        target,
        parsedTripDates.startDate,
        parsedTripDates.endDate
      );
      if (cancelled) return;

      if (!period || period.days.length === 0) {
        setTripDays([]);
        setTripInsight(null);
        setTripDaysLoading(false);
        setTripInsightLoading(false);
        return;
      }

      setTripDays(period.days);
      setTripDaysLoading(false);

      try {
        const res = await fetch("/api/weather-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination: primaryTrip.destination,
            country: primaryTrip.country,
            dateLabel: parsedTripDates.label,
            startDate: parsedTripDates.startDate,
            endDate: parsedTripDates.endDate,
            days: period.days,
          }),
        });

        if (cancelled) return;

        if (res.ok) {
          const data = (await res.json()) as TripWeatherInsight;
          setTripInsight(data);
        } else {
          setTripInsight(null);
        }
      } catch {
        if (!cancelled) setTripInsight(null);
      }

      if (!cancelled) setTripInsightLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, primaryTrip, parsedTripDates, query]);

  return (
    <div className="flex flex-col gap-5 px-5 pb-10 pt-5">
      <header className="flex flex-col gap-2">
        <h2 className="text-[22px] font-bold tracking-tight text-ink-heading">
          여행지 날씨
        </h2>
        <p className="text-sm leading-6 text-ink-body">
          여행 도시의 현재 날씨와 앞으로 5일 예보를 확인할 수 있어요.
        </p>
      </header>

      <section className="rounded-xl2 border border-line-soft bg-surface-white p-4 shadow-soft">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-caption">도시</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 뉴욕, 도쿄, 파리"
            className="h-11 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
          />
        </label>
        {primaryTrip ? (
          <p className="mt-2 text-xs text-ink-caption">
            진행 중인 여행: {primaryTrip.destination}
          </p>
        ) : null}
      </section>

      {primaryTrip && parsedTripDates ? (
        <section className="rounded-xl2 border border-brand/15 bg-surface-white p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg ai-gradient-bg">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-ink-heading">AI 여행 기상</h3>
              <p className="text-xs text-ink-caption">
                {parsedTripDates.label} · {primaryTrip.destination}
                {usesMonthlyClimate && travelMonth
                  ? ` · ${travelMonth}월 기후 예측`
                  : null}
              </p>
            </div>
          </div>

          {tripDaysLoading ? (
            <AILoadingPanel
              title="여행 월 기후 분석 중"
              description={
                travelMonth
                  ? `${travelMonth}월 평균 기후 데이터를 불러오고 있어요`
                  : "여행 월 기후 데이터를 확인하고 있어요"
              }
            />
          ) : tripDays.length > 0 ? (
            <div className="flex flex-col gap-3">
              {tripInsightLoading ? (
                <AILoadingPanel
                  title="AI 여행 기상 분석 중"
                  description={
                    travelMonth
                      ? `${travelMonth}월 기후 패턴을 바탕으로 대비 팁을 만들고 있어요`
                      : "여행 월 기후를 바탕으로 대비 팁을 만들고 있어요"
                  }
                />
              ) : tripInsight ? (
                <>
                  <AIInsightBadge>{tripInsight.summary}</AIInsightBadge>
                  <div className="rounded-xl border border-line-soft bg-surface-base p-3">
                    <p className="mb-2 text-xs font-semibold text-ink-caption">
                      날씨 대비 체크
                    </p>
                    <ul className="flex flex-col gap-2">
                      {tripInsight.preparation.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-sm leading-6 text-ink-body"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-ink-caption">
                  {usesMonthlyClimate && travelMonth
                    ? `${travelMonth}월 평균 기후 기준 예상`
                    : "여행 기간 예상 날씨"}
                </p>
                {tripDays.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between rounded-lg border border-line-soft bg-surface-base px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink-heading">
                        {day.label}
                      </p>
                      <p className="text-xs text-ink-caption">{day.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-ink-heading">
                        {day.minC}° / {day.maxC}°
                      </p>
                      <p className="text-[10px] font-medium text-brand">
                        {day.source === "forecast" ? "예보" : "월별 기후"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-caption">
              여행 일정 날씨를 불러오지 못했어요. 도시 이름을 확인해 주세요.
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-xl2 border border-dashed border-line-soft bg-surface-white px-4 py-5 text-center">
          <p className="text-sm text-ink-caption">
            여행을 등록하면 AI가 여행 날짜 기준 날씨 대비 팁을 알려드려요.
          </p>
        </section>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl2 bg-surface-soft" />
      ) : error ? (
        <p className="rounded-xl2 border border-line-soft bg-surface-white px-4 py-6 text-center text-sm text-ink-caption">
          {error}
        </p>
      ) : forecast ? (
        <>
          <section className="rounded-xl2 border border-brand/15 bg-gradient-to-br from-brand/8 to-brand-soft/10 p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink-caption">
                  <MapPin className="h-3.5 w-3.5" />
                  {forecast.place}
                </div>
                <p className="text-4xl font-extrabold text-ink-heading">
                  {forecast.currentTempC}°
                </p>
                <p className="mt-1 text-sm font-semibold text-brand-strong">
                  {forecast.currentDescription}
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-white/80">
                <CloudSun className="h-6 w-6 text-brand" />
              </span>
            </div>
          </section>

          <section className="rounded-xl2 border border-line-soft bg-surface-white p-4 shadow-soft">
            <h3 className="mb-3 text-sm font-bold text-ink-heading">5일 예보</h3>
            <div className="flex flex-col gap-2">
              {forecast.days.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between rounded-lg border border-line-soft bg-surface-base px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-heading">{day.label}</p>
                    <p className="text-xs text-ink-caption">{day.description}</p>
                  </div>
                  <p className="text-sm font-bold text-ink-heading">
                    {day.minC}° / {day.maxC}°
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-xl2 border border-dashed border-line-soft bg-surface-white px-4 py-10 text-center text-sm text-ink-caption">
          도시를 입력하면 날씨가 표시돼요.
        </p>
      )}
    </div>
  );
}
