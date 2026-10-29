"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CustomOverlayMap,
  Map,
  MapMarker,
  Polyline,
  useKakaoLoader,
} from "react-kakao-maps-sdk";
import { PinBadge } from "@/components/map/PinBadge";
import type { TripMapProps } from "@/components/map/types";
import { dayColor } from "@/lib/map/day-colors";
import {
  boundsOf,
  extractMapPoints,
  type MapPoint,
} from "@/lib/map/trip-points";

function formatSpend(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function spendTier(amount: number): 0 | 1 | 2 | 3 {
  if (amount <= 0) return 0;
  if (amount < 30000) return 1;
  if (amount < 100000) return 2;
  return 3;
}

function useFitKakaoBounds(
  map: kakao.maps.Map | null,
  points: MapPoint[]
) {
  useEffect(() => {
    if (!map || !points.length || typeof window === "undefined") return;
    const kakaoMaps = window.kakao?.maps;
    if (!kakaoMaps) return;
    const b = boundsOf(points);
    if (!b) return;
    const bounds = new kakaoMaps.LatLngBounds();
    for (const p of points) {
      bounds.extend(new kakaoMaps.LatLng(p.lat, p.lng));
    }
    map.setBounds(bounds, 40, 40, 40, 40);
  }, [map, points]);
}

export default function KakaoTripMap(props: TripMapProps) {
  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim() ?? "";
  const [loading, error] = useKakaoLoader({
    appkey,
    libraries: ["services"],
  });

  const allPoints = useMemo(
    () => extractMapPoints(props.days),
    [props.days]
  );
  const points = useMemo(() => {
    if (props.selectedDay === "all") return allPoints;
    return allPoints.filter((p) => p.day === props.selectedDay);
  }, [allPoints, props.selectedDay]);

  const mapRef = useRef<kakao.maps.Map | null>(null);
  useFitKakaoBounds(mapRef.current, points);

  if (!appkey) return null;
  if (error) {
    console.warn(
      "[map/kakao] load failed (도메인 미등록 401 / 사용설정 OFF 403 가능):",
      error
    );
    return null;
  }
  if (loading) {
    return (
      <div
        className={
          props.className ??
          "flex h-64 w-full items-center justify-center rounded-2xl bg-surface-soft text-sm text-ink-caption"
        }
      >
        지도를 불러오는 중…
      </div>
    );
  }

  const center = points[0]
    ? { lat: points[0].lat, lng: points[0].lng }
    : { lat: 37.5665, lng: 126.978 };

  const byDay = new globalThis.Map<number, MapPoint[]>();
  for (const p of points) {
    const list = byDay.get(p.day) ?? [];
    list.push(p);
    byDay.set(p.day, list);
  }

  return (
    <Map
      className={props.className ?? "h-64 w-full rounded-2xl"}
      center={center}
      level={5}
      onCreate={(map) => {
        mapRef.current = map;
        const b = boundsOf(points);
        if (!b || !window.kakao?.maps) return;
        const bounds = new window.kakao.maps.LatLngBounds();
        for (const p of points) {
          bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng));
        }
        map.setBounds(bounds, 40, 40, 40, 40);
      }}
    >
      {[...byDay.entries()].map(([day, pts]) => {
        if (pts.length < 2) return null;
        const sorted = [...pts].sort((a, b) => a.order - b.order);
        return (
          <Polyline
            key={`poly-${day}`}
            path={sorted.map((p) => ({ lat: p.lat, lng: p.lng }))}
            strokeWeight={3}
            strokeColor={dayColor(day - 1)}
            strokeOpacity={0.85}
            strokeStyle="solid"
          />
        );
      })}

      {points.map((point) => {
        const spend =
          point.placeId && props.spendByPlaceId
            ? props.spendByPlaceId[point.placeId]
            : undefined;
        const badge = (
          <button
            type="button"
            onClick={() => props.onSelectPoint?.(point)}
            className="border-0 bg-transparent p-0"
          >
            <PinBadge
              day={point.day}
              order={point.order}
              highlighted={props.highlightKey === point.key}
              spendLabel={
                typeof spend === "number" && spend > 0
                  ? formatSpend(spend)
                  : undefined
              }
              spendTier={
                typeof spend === "number" ? spendTier(spend) : 0
              }
            />
          </button>
        );

        if (props.draggableMarkers) {
          return (
            <MapMarker
              key={point.key}
              position={{ lat: point.lat, lng: point.lng }}
              draggable
              onDragEnd={(marker) => {
                const pos = marker.getPosition();
                props.onMarkerDragEnd?.(point, {
                  lat: pos.getLat(),
                  lng: pos.getLng(),
                });
              }}
              onClick={() => props.onSelectPoint?.(point)}
            >
              {badge}
            </MapMarker>
          );
        }

        return (
          <CustomOverlayMap
            key={point.key}
            position={{ lat: point.lat, lng: point.lng }}
            yAnchor={1}
          >
            {badge}
          </CustomOverlayMap>
        );
      })}
    </Map>
  );
}
