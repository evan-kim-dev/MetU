"use client";

import { useState } from "react";
import Image from "next/image";
import { DealDetailSheet } from "@/components/home/DealDetailSheet";
import type { DealPlace } from "@/lib/deals/data";

interface RecommendedGridProps {
  places: DealPlace[];
}

/**
 * AI 예산별 추천 여행지 그리드.
 * 항공·숙소 저가 시세 기반. 배너 클릭 시 상세 시트를 연다.
 */
export function RecommendedGrid({ places }: RecommendedGridProps) {
  const [selected, setSelected] = useState<DealPlace | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {places.map((place) => (
          <button
            key={place.id}
            type="button"
            onClick={() => setSelected(place)}
            className="relative aspect-[4/5] overflow-hidden rounded-2xl text-left shadow-soft transition-transform active:scale-[0.98]"
          >
            <Image
              src={place.imageUrl}
              alt={`${place.name} 이미지`}
              fill
              sizes="220px"
              className="object-cover"
            />
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
