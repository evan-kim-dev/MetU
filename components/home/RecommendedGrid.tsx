"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { DealDetailSheet } from "@/components/home/DealDetailSheet";
import type { DealPlace } from "@/lib/deals/data";

interface RecommendedGridProps {
  places: DealPlace[];
}

/**
 * AI 예산별 추천 여행지 그리드.
 * 시즌 RAG + LLM으로 정렬·하이라이트를 갱신한다.
 */
export function RecommendedGrid({ places }: RecommendedGridProps) {
  const [items, setItems] = useState(places);
  const [selected, setSelected] = useState<DealPlace | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setItems(places);
  }, [places]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetch("/api/recommended-deals", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("recommended-deals-failed");
        return (await res.json()) as { places?: DealPlace[] };
      })
      .then((data) => {
        if (Array.isArray(data.places) && data.places.length > 0) {
          setItems(data.places);
        }
      })
      .catch((error) => {
        if ((error as Error)?.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  if (items.length === 0) {
    if (loading) {
      return (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-soft"
            />
          ))}
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-dashed border-line-soft bg-surface-soft/50 px-4 py-8 text-center">
        <p className="text-sm font-semibold text-ink-heading">
          추천 여행지를 불러오지 못했어요
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-caption">
          잠시 후 다시 시도하거나, 직접 여행을 계획해 보세요.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className={[
          "grid grid-cols-2 gap-3 transition-opacity",
          loading ? "opacity-90" : "opacity-100",
        ].join(" ")}
      >
        {items.map((place) => (
          <button
            key={place.id}
            type="button"
            onClick={() => setSelected(place)}
            className="relative aspect-[4/5] overflow-hidden rounded-2xl text-left shadow-soft transition-transform active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand/70 via-brand-strong/70 to-ink-heading/80" />
            {!failedImageIds.has(place.id) ? (
              <Image
                src={place.imageUrl}
                alt={`${place.name} 이미지`}
                fill
                sizes="220px"
                className="object-cover"
                unoptimized
                onError={() =>
                  setFailedImageIds((prev) => new Set(prev).add(place.id))
                }
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

            <span className="absolute left-2.5 top-2.5 rounded-full bg-surface-white/85 px-2 py-0.5 text-[11px] font-extrabold text-brand-strong backdrop-blur-md">
              {place.budgetLabel}
            </span>

            <div className="absolute inset-x-3 bottom-3 text-surface-white">
              <p className="text-[11px] font-medium opacity-90">{place.country}</p>
              <p className="text-base font-extrabold drop-shadow-sm">
                {place.name}
              </p>
              {place.highlight && (
                <p className="mt-0.5 line-clamp-1 text-[10px] font-medium opacity-85">
                  {place.highlight}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <DealDetailSheet place={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
