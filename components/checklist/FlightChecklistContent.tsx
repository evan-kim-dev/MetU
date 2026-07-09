"use client";

import { useMemo, useState } from "react";
import { LocateFixed, Plane, ShieldCheck } from "lucide-react";
import { AirportSearchField } from "@/components/onboarding/AirportSearchField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Counter } from "@/components/ui/Counter";
import type { AirportPlace } from "@/lib/airports/data";
import {
  formatAirportInputLabel,
  formatAirportKeyword,
} from "@/lib/airports/data";
import {
  fetchIcnAirlineProfiles,
  type IcnAirlineProfile,
} from "@/lib/airlines/icn";
import { filterValidFlights } from "@/lib/flights/validate";

type FlightItem = {
  id: string;
  price: string;
  carrier: string;
  outbound: string;
  inbound: string;
  route: string;
  duration: string;
  stops: string;
  bookingUrl?: string;
};

type SearchResponse = {
  flights: FlightItem[];
  warning?: string;
  source?: "fallback" | "google-flights" | "naver-flights";
  bookingUrl?: string;
  naverBookingUrl?: string;
  error?: string;
  info?: "no-valid-flights";
};

const FLIGHT_CHECK_ITEMS = [
  "여권 영문 이름과 항공권 이름 철자 일치",
  "수하물 규정(기내/위탁)과 추가 요금 확인",
  "출국 24시간 전 온라인 체크인 가능 여부 확인",
];

function formatDateLabel(input: string): string {
  if (!input) return "-";
  const date = new Date(input);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return input;
}

function defaultDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function formatFlightSearchValue(place: AirportPlace): string {
  return formatAirportInputLabel(place);
}

export function FlightChecklistContent() {
  const [origin, setOrigin] = useState("인천국제공항(ICN)");
  const [destination, setDestination] = useState("나리타국제공항(NRT)");
  const [departDate, setDepartDate] = useState(defaultDate(30));
  const [returnDate, setReturnDate] = useState(defaultDate(37));
  const [adults, setAdults] = useState(1);
  const [cabinClass, setCabinClass] = useState("economy");
  const [sortBy, setSortBy] = useState("best");
  const [loading, setLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [source, setSource] = useState<SearchResponse["source"]>();
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [naverBookingUrl, setNaverBookingUrl] = useState<string | null>(null);
  const [flights, setFlights] = useState<FlightItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [airlineProfiles, setAirlineProfiles] = useState<
    Record<string, IcnAirlineProfile>
  >({});

  const validFlights = useMemo(() => filterValidFlights(flights), [flights]);

  const canSearch = useMemo(() => {
    return (
      origin.trim().length > 0 &&
      destination.trim().length > 0 &&
      departDate.length > 0 &&
      returnDate.length > 0
    );
  }, [departDate, destination, origin, returnDate]);

  async function onSearch() {
    if (!canSearch || loading) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    setSource(undefined);
    setBookingUrl(null);
    setNaverBookingUrl(null);
    setAirlineProfiles({});
    try {
      const params = new URLSearchParams({
        origin,
        destination,
        departDate,
        returnDate,
        adults: String(adults),
        cabinClass,
        sortBy,
      });
      const res = await fetch(`/api/flights/search?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as SearchResponse;
      setHasSearched(true);
      if (!res.ok) {
        setFlights([]);
        setError(data.error ?? "항공권 조회에 실패했어요.");
        return;
      }
      const nextFlights = filterValidFlights(data.flights ?? []);
      setFlights(nextFlights);
      setWarning(
        data.info === "no-valid-flights"
          ? null
          : data.warning ?? null
      );
      setSource(data.source);
      setBookingUrl(data.bookingUrl ?? nextFlights[0]?.bookingUrl ?? null);
      setNaverBookingUrl(data.naverBookingUrl ?? null);

      const carriers = nextFlights.map((flight) => flight.carrier);
      const profiles = await fetchIcnAirlineProfiles(carriers);
      setAirlineProfiles(profiles);
    } catch {
      setFlights([]);
      setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function onUseNearbyOrigin() {
    if (nearbyLoading || typeof navigator === "undefined") return;
    setNearbyLoading(true);
    setError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      const params = new URLSearchParams({
        lat: String(position.coords.latitude),
        lng: String(position.coords.longitude),
      });
      const res = await fetch(`/api/flights/nearby?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        airports?: string[];
        warning?: string;
        error?: string;
      };
      if (!res.ok || !data.airports?.length) {
        setError(data.error ?? "주변 공항을 찾지 못했어요.");
        return;
      }
      setOrigin(formatAirportKeyword(data.airports[0]));
      if (data.warning) {
        setWarning(data.warning);
      }
    } catch {
      setError("위치 권한이 필요해요. 브라우저에서 위치 허용 후 다시 시도해주세요.");
    } finally {
      setNearbyLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-10 pt-5">
      <header className="flex flex-col gap-2">
        <h2 className="text-[22px] font-bold tracking-tight text-ink-heading">
          항공 체크리스트
        </h2>
        <p className="text-sm leading-6 text-ink-body">
          출발지/도착지와 날짜를 입력하면 네이버 항공권 기준으로 조회하고, 결과가 없으면 Google Flights로 이어서 찾아요.
        </p>
      </header>

      <section className="rounded-xl2 border border-line-soft bg-surface-white p-4 shadow-soft">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-1">
            <AirportSearchField
              label="출발지"
              placeholder="예: 인천국제공항(ICN)"
              value={origin}
              onChange={setOrigin}
              formatValue={formatFlightSearchValue}
              variant="compact"
              trailing={
                <button
                  type="button"
                  onClick={onUseNearbyOrigin}
                  disabled={nearbyLoading}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-soft text-ink-body"
                  title="내 주변 공항"
                >
                  <LocateFixed className="h-4 w-4" />
                </button>
              }
            />
          </div>
          <div className="col-span-1">
            <AirportSearchField
              label="도착지"
              placeholder="예: 나리타국제공항(NRT)"
              value={destination}
              onChange={setDestination}
              formatValue={formatFlightSearchValue}
              variant="compact"
            />
          </div>
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">출발일</span>
            <input
              type="date"
              value={departDate}
              onChange={(e) => setDepartDate(e.target.value)}
              className="h-10 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">귀국일</span>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="h-10 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">인원</span>
            <Counter
              value={adults}
              onChange={setAdults}
              min={1}
              max={9}
              unit="명"
              variant="compact"
            />
          </label>
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">좌석 등급</span>
            <select
              value={cabinClass}
              onChange={(e) => setCabinClass(e.target.value)}
              className="h-10 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
            >
              <option value="economy">이코노미</option>
              <option value="premium_economy">프리미엄 이코노미</option>
              <option value="business">비즈니스</option>
              <option value="first">퍼스트</option>
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">정렬</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
            >
              <option value="best">추천순</option>
              <option value="fastest">최단시간순</option>
              <option value="price_high">가격순</option>
            </select>
          </label>
        </div>

        <PrimaryButton
          className="mt-3"
          disabled={!canSearch}
          loading={loading}
          onClick={onSearch}
        >
          {loading ? "조회 중..." : "항공권 조회"}
        </PrimaryButton>
      </section>

      {error ? (
        <section className="rounded-xl2 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}
      {warning ? (
        <section className="rounded-xl2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {warning}
        </section>
      ) : null}
      {source === "naver-flights" && validFlights.length > 0 ? (
        <section className="rounded-xl2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          네이버 항공권 최저가(직항·왕복) 기준으로 조회했어요. 예약은 네이버 항공에서 진행해주세요.
        </section>
      ) : null}
      {source === "google-flights" && validFlights.length > 0 ? (
        <section className="rounded-xl2 border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Google Flights 공개 데이터로 조회했어요. 예약은 Google Flights에서 직접 진행해주세요.
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        {!hasSearched && !loading ? (
          <article className="rounded-xl2 border border-dashed border-line-soft bg-surface-white px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink-heading">
              항공권을 조회하면 추천 결과가 여기에 보여요.
            </p>
          </article>
        ) : null}

        {hasSearched && !loading && validFlights.length === 0 ? (
          <article className="rounded-xl2 border border-dashed border-line-soft bg-surface-white px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink-heading">
              직항/경유 항공편이 없어요!
            </p>
            <p className="mt-1 text-xs text-ink-caption">
              날짜나 공항을 바꿔 다시 검색해 보세요.
            </p>
          </article>
        ) : null}

        {validFlights.map((flight) => {
          const profile = airlineProfiles[flight.carrier];
          const displayName = profile?.name || flight.carrier;
          return (
          <article
            key={flight.id}
            className="rounded-xl2 border border-line-soft bg-surface-white p-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                {profile?.image ? (
                  <img
                    src={profile.image}
                    alt={displayName}
                    className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border border-line-soft bg-surface-soft object-contain p-1"
                  />
                ) : (
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Plane className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink-heading">{displayName}</p>
                  <p className="mt-0.5 text-xs text-ink-caption">
                    {profile?.iata ? `${profile.iata} · ` : ""}
                    {flight.route}
                  </p>
                </div>
              </div>
              <p className="text-base font-extrabold text-ink-heading">{flight.price}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-body">
              <div className="rounded-lg bg-surface-soft px-3 py-2">
                <p className="font-semibold">출발</p>
                <p>{formatDateLabel(flight.outbound)}</p>
              </div>
              <div className="rounded-lg bg-surface-soft px-3 py-2">
                <p className="font-semibold">귀국</p>
                <p>{formatDateLabel(flight.inbound)}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-caption">
              <Plane className="h-3.5 w-3.5 text-brand" />
              <span>{flight.duration}</span>
              <span>·</span>
              <span>{flight.stops}</span>
            </div>
            {flight.bookingUrl || bookingUrl ? (
              <a
                href={flight.bookingUrl ?? bookingUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border border-brand/20 bg-brand/5 text-sm font-semibold text-brand"
              >
                {source === "naver-flights"
                  ? "네이버 항공에서 보기"
                  : "Google Flights에서 보기"}
              </a>
            ) : null}
            {source === "google-flights" && naverBookingUrl ? (
              <a
                href={naverBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg border border-line-soft bg-surface-soft text-sm font-semibold text-ink-body"
              >
                네이버 항공에서 직접 보기
              </a>
            ) : null}
          </article>
        );
        })}
      </section>

      <section className="rounded-xl2 border border-line-soft bg-surface-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4.5 w-4.5 text-brand" />
          <h3 className="text-sm font-bold text-ink-heading">예약 전 체크리스트</h3>
        </div>
        <ul className="flex flex-col gap-2">
          {FLIGHT_CHECK_ITEMS.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-line-soft bg-surface-base px-3 py-2.5 text-sm text-ink-body"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
