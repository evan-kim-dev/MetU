"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { TripMapProps } from "@/components/map/types";
import { regionOf } from "@/lib/geo/region";
import { hasBrowserMapKeys, mapProviderFor } from "@/lib/map/provider";

const GoogleTripMap = dynamic(() => import("@/components/map/GoogleTripMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-2xl bg-surface-soft text-sm text-ink-caption">
      지도를 불러오는 중…
    </div>
  ),
});

const KakaoTripMap = dynamic(() => import("@/components/map/KakaoTripMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-2xl bg-surface-soft text-sm text-ink-caption">
      지도를 불러오는 중…
    </div>
  ),
});

export function TripMap(props: TripMapProps) {
  const provider = useMemo(() => {
    const region = regionOf({
      country: props.country,
      destination: props.destination,
    });
    return mapProviderFor(region, hasBrowserMapKeys());
  }, [props.country, props.destination]);

  if (!provider) return null;

  if (provider === "kakao") {
    return <KakaoTripMap {...props} />;
  }
  return <GoogleTripMap {...props} />;
}
