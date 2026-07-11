"use client";

import { useMemo, useState } from "react";
import { BedDouble, MapPin, ShieldCheck, SlidersHorizontal, Star } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Counter } from "@/components/ui/Counter";
import { HOTEL_DESTINATION_SUGGESTIONS } from "@/lib/hotels/destinations";
import { useWithactChecklist } from "@/lib/checklist/useWithactChecklist";

type HotelItem = {
  id: string;
  name: string;
  area: string;
  rating?: number | null;
  reviewCount?: number | null;
  price: string;
  badge: string;
  bookingUrl?: string;
};

type SearchResponse = {
  hotels: HotelItem[];
  source?: "hotelbeds" | "google-hotels";
  bookingUrl?: string;
  warning?: string;
  error?: string;
  info?: "no-hotels";
};

const HOTEL_CHECK_ITEMS = [
  {
    title: "무료 취소 마감일 확인",
    detail: "출발 72시간 전까지 무료 취소 가능 여부 체크",
    icon: ShieldCheck,
  },
  {
    title: "체크인/체크아웃 시간",
    detail: "얼리 체크인 가능 여부와 추가 요금 확인",
    icon: BedDouble,
  },
  {
    title: "결제 방식 / 보증금",
    detail: "현장 결제·선결제·보증금 규정까지 확인",
    icon: MapPin,
  },
];

function defaultDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function HotelChecklistContent() {
  const [destination, setDestination] = useState("도쿄 · 시부야");
  const [checkIn, setCheckIn] = useState(defaultDate(30));
  const [checkOut, setCheckOut] = useState(defaultDate(32));
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [children, setChildren] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [source, setSource] = useState<SearchResponse["source"]>();
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [hotels, setHotels] = useState<HotelItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const { persistItem } = useWithactChecklist();

  const canSearch = useMemo(() => {
    return destination.trim().length > 0 && checkIn.length > 0 && checkOut.length > 0;
  }, [checkIn, checkOut, destination]);

  async function onSearch() {
    if (!canSearch || loading) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    setSource(undefined);
    setBookingUrl(null);

    try {
      const params = new URLSearchParams({
        destination,
        checkIn,
        checkOut,
        adults: String(adults),
        rooms: String(rooms),
        children: String(children),
      });
      const res = await fetch(`/api/hotels/search?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as SearchResponse;
      setHasSearched(true);

      if (!res.ok) {
        setHotels([]);
        setError(data.error ?? "숙소 조회에 실패했어요.");
        return;
      }

      const items = data.hotels ?? [];
      if (items.length === 0) {
        setHotels([]);
        setWarning("조건에 맞는 숙소를 찾지 못했어요. 날짜나 지역을 바꿔 보세요.");
      } else {
        setHotels(items);
      }
      setSource(data.source);
      setBookingUrl(data.bookingUrl ?? items[0]?.bookingUrl ?? null);
      if (items.length > 0) {
        setWarning(data.warning ?? null);
      }

      void persistItem({
        itemType: "HOTEL",
        itemStatus: "SEARCHED",
        itemName: destination,
        itemSummary: `${items.length}건 · ${checkIn} ~ ${checkOut}`,
        externalProvider: data.source,
      });
    } catch {
      setHotels([]);
      setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-10 pt-5">
      <section className="rounded-2xl border-0 bg-surface-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">지역</span>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="h-10 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
            >
              {HOTEL_DESTINATION_SUGGESTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">체크인</span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="h-10 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">체크아웃</span>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="h-10 rounded-lg border border-line-soft px-3 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">성인</span>
            <Counter value={adults} onChange={setAdults} min={1} max={9} unit="명" variant="compact" />
          </label>
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">아동</span>
            <Counter value={children} onChange={setChildren} min={0} max={8} unit="명" variant="compact" />
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-caption">객실</span>
            <Counter value={rooms} onChange={setRooms} min={1} max={4} unit="실" variant="compact" />
          </label>
        </div>

        <PrimaryButton className="mt-3" disabled={!canSearch} loading={loading} onClick={onSearch}>
          {loading ? "조회 중..." : "숙소 조회"}
        </PrimaryButton>
      </section>

      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}
      {source === "hotelbeds" && hotels.length > 0 ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Hotelbeds 실시간 요금으로 조회했어요.
        </section>
      ) : null}
      <section className="flex flex-col gap-3">
        {!hasSearched && !loading ? (
          <article className="rounded-2xl border-0 bg-surface-soft shadow-sm bg-surface-white px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink-heading">
              숙소를 조회하면 추천 결과가 여기에 보여요.
            </p>
          </article>
        ) : null}

        {hotels.map((hotel) => (
          <article
            key={hotel.id}
            className="rounded-2xl border-0 bg-surface-white p-5 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-extrabold text-ink-heading">
                  {hotel.name}
                </h3>
                <p className="mt-1 text-xs text-ink-caption">{hotel.area}</p>
              </div>
              <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">
                {hotel.badge}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {hotel.rating ? (
                <div className="inline-flex items-center gap-1 text-sm font-semibold text-ink-body">
                  <Star className="h-4 w-4 fill-star text-star" />
                  {hotel.rating.toFixed(1)}
                </div>
              ) : (
                <span className="text-xs text-ink-caption">등급 정보 없음</span>
              )}
              <p className="text-sm font-extrabold text-ink-heading">
                {hotel.price}
                <span className="ml-1 text-xs font-medium text-ink-caption">/박</span>
              </p>
            </div>
            {(hotel.bookingUrl || bookingUrl) && (
              <a
                href={hotel.bookingUrl ?? bookingUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  void persistItem({
                    itemType: "HOTEL",
                    itemStatus: "SELECTED",
                    itemName: hotel.name,
                    itemSummary: `${hotel.area} · ${hotel.price}`,
                    externalProvider: source,
                    externalItemId: hotel.id,
                    externalUrl: hotel.bookingUrl ?? bookingUrl ?? undefined,
                    selected: true,
                  });
                }}
                className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border border-brand/20 bg-brand/5 text-sm font-semibold text-brand"
              >
                Google Hotels에서 보기
              </a>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-2xl border-0 bg-surface-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="h-4.5 w-4.5 text-brand" />
          <h3 className="text-sm font-bold text-ink-heading">예약 전 체크리스트</h3>
        </div>
        <ul className="flex flex-col gap-2">
          {HOTEL_CHECK_ITEMS.map((check) => (
            <li
              key={check.title}
              className="rounded-lg border border-line-soft bg-surface-base px-3 py-2.5"
            >
              <div className="flex items-start gap-2">
                <check.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <p className="text-sm font-semibold text-ink-heading">{check.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-caption">{check.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
