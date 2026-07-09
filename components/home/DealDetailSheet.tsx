"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plane,
  Sparkles,
  Wallet,
  X,
  BedDouble,
  Lightbulb,
} from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { formatKRW } from "@/lib/mock/home";
import type { DealDetail, DealPlace } from "@/lib/deals/data";

interface DealDetailSheetProps {
  place: DealPlace;
  onClose: () => void;
}

export function DealDetailSheet({ place, onClose }: DealDetailSheetProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/deals/${place.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("failed");
        return (await res.json()) as DealDetail;
      })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [place.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-mobile flex-col overflow-hidden rounded-t-3xl bg-surface-base shadow-soft">
        <div className="relative h-44 shrink-0">
          <Image
            src={place.imageUrl}
            alt={place.name}
            fill
            sizes="440px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <button
            type="button"
            aria-label="시트 닫기"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-surface-white backdrop-blur-sm"
          >
            <X className="h-5 w-5" strokeWidth={2.3} />
          </button>
          <div className="absolute bottom-4 left-4 right-4 text-surface-white">
            <p className="text-xs font-semibold opacity-90">{place.country}</p>
            <h3 className="text-2xl font-extrabold">{place.name}</h3>
            <p className="mt-1 text-sm font-bold text-[#93C5FD]">
              {place.budgetLabel} · {place.highlight}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Sparkles className="h-7 w-7 animate-pulse text-brand" />
              <p className="text-sm font-semibold text-ink-body">
                AI가 항공·숙소 저가 시세를 정리 중...
              </p>
            </div>
          )}

          {!loading && error && (
            <p className="py-8 text-center text-sm text-ink-caption">
              정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
            </p>
          )}

          {!loading && detail && (
            <div className="flex flex-col gap-5">
              <p className="text-sm leading-relaxed text-ink-body">
                {detail.summary}
              </p>

              <div className="rounded-xl border border-line-soft bg-surface-white px-4 py-3">
                <p className="text-xs font-semibold text-ink-caption">저가 항공 기준</p>
                <p className="mt-1 text-sm font-bold text-ink-heading">
                  {detail.airline}
                </p>
                <p className="text-xs text-ink-body">{detail.route}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <InfoChip
                  icon={<Plane className="h-4 w-4 text-brand" />}
                  label="항공 최저"
                  value={formatKRW(detail.flightFrom)}
                />
                <InfoChip
                  icon={<BedDouble className="h-4 w-4 text-brand" />}
                  label="숙소 최저"
                  value={formatKRW(detail.hotelFrom)}
                />
                <InfoChip
                  icon={<CalendarDays className="h-4 w-4 text-brand" />}
                  label="추천 시기"
                  value={detail.bestMonth}
                />
                <InfoChip
                  icon={<Wallet className="h-4 w-4 text-brand" />}
                  label={`${detail.nights}박 총예산`}
                  value={formatKRW(detail.fromPrice)}
                />
              </div>

              <DetailBlock title="예산에 맞춘 이유" items={detail.whyCheap} />
              <DetailBlock
                title="알뜰 여행 팁"
                items={detail.budgetTips}
                icon={<Lightbulb className="h-4 w-4 text-brand" />}
              />
              <DetailBlock title="추천 코스" items={detail.mustTry} />

              <p className="rounded-xl border border-line-soft bg-surface-white px-4 py-3 text-xs leading-relaxed text-ink-caption">
                {detail.caution}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-line-soft bg-surface-white px-5 py-4">
          <PrimaryButton
            onClick={() => {
              onClose();
              router.push("/onboarding");
            }}
          >
            이 여행지로 계획 시작하기
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function InfoChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-surface-white px-3 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-ink-caption">
        {icon}
        {label}
      </div>
      <p className="text-sm font-extrabold text-ink-heading">{value}</p>
    </div>
  );
}

function DetailBlock({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <h4 className="text-sm font-extrabold text-ink-heading">{title}</h4>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-lg bg-surface-white px-3 py-2.5 text-sm text-ink-body shadow-sm"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
