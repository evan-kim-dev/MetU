"use client";

import { useEffect, useMemo } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  useMap,
  type MapCameraChangedEvent,
} from "@vis.gl/react-google-maps";
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

function FitBounds({
  points,
}: {
  points: MapPoint[];
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points.length) return;
    const b = boundsOf(points);
    if (!b) return;
    const bounds = new google.maps.LatLngBounds(
      { lat: b.south, lng: b.west },
      { lat: b.north, lng: b.east }
    );
    map.fitBounds(bounds, 40);
  }, [map, points]);
  return null;
}

function DayPolylines({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    const byDay = new globalThis.Map<number, MapPoint[]>();
    for (const p of points) {
      const list = byDay.get(p.day) ?? [];
      list.push(p);
      byDay.set(p.day, list);
    }
    const lines: google.maps.Polyline[] = [];
    for (const [day, pts] of byDay) {
      if (pts.length < 2) continue;
      const sorted = [...pts].sort((a, b) => a.order - b.order);
      const line = new google.maps.Polyline({
        path: sorted.map((p) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: dayColor(day - 1),
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map,
      });
      lines.push(line);
    }
    return () => {
      for (const line of lines) line.setMap(null);
    };
  }, [map, points]);
  return null;
}

function GoogleMapInner(props: TripMapProps) {
  const allPoints = useMemo(
    () => extractMapPoints(props.days),
    [props.days]
  );
  const points = useMemo(() => {
    if (props.selectedDay === "all") return allPoints;
    return allPoints.filter((p) => p.day === props.selectedDay);
  }, [allPoints, props.selectedDay]);

  const center = points[0]
    ? { lat: points[0].lat, lng: points[0].lng }
    : { lat: 37.5665, lng: 126.978 };

  const mapId =
    process.env.NEXT_PUBLIC_GOOGLE_MAP_ID?.trim() || "DEMO_MAP_ID";

  return (
    <Map
      className={props.className ?? "h-64 w-full rounded-2xl"}
      defaultCenter={center}
      defaultZoom={13}
      mapId={mapId}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      onCameraChanged={(_e: MapCameraChangedEvent) => undefined}
    >
      <FitBounds points={points} />
      <DayPolylines points={points} />
      {points.map((point) => {
        const spend =
          point.placeId && props.spendByPlaceId
            ? props.spendByPlaceId[point.placeId]
            : undefined;
        return (
          <AdvancedMarker
            key={point.key}
            position={{ lat: point.lat, lng: point.lng }}
            draggable={Boolean(props.draggableMarkers)}
            onClick={() => props.onSelectPoint?.(point)}
            onDragEnd={(e) => {
              const lat = e.latLng?.lat();
              const lng = e.latLng?.lng();
              if (
                typeof lat === "number" &&
                typeof lng === "number" &&
                props.onMarkerDragEnd
              ) {
                props.onMarkerDragEnd(point, { lat, lng });
              }
            }}
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
          </AdvancedMarker>
        );
      })}
    </Map>
  );
}

export default function GoogleTripMap(props: TripMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim();
  if (!apiKey) return null;

  return (
    <APIProvider apiKey={apiKey}>
      <GoogleMapInner {...props} />
    </APIProvider>
  );
}
