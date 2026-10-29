import type { PlaceKind } from "@/lib/places/types";
import type { TripDaySchedule } from "@/lib/trips/types";

export interface MapPoint {
  key: string;
  day: number;
  order: number;
  title: string;
  time: string;
  lat: number;
  lng: number;
  placeId?: string;
  kind?: PlaceKind;
  hoursKnown?: boolean;
}

function timeToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function extractMapPoints(days: TripDaySchedule[]): MapPoint[] {
  const out: MapPoint[] = [];
  for (const day of days) {
    const indexed = day.items.map((item, itemIndex) => ({ item, itemIndex }));
    indexed.sort(
      (a, b) => timeToMinutes(a.item.time) - timeToMinutes(b.item.time)
    );
    let order = 0;
    for (const { item, itemIndex } of indexed) {
      if (
        typeof item.lat !== "number" ||
        typeof item.lng !== "number" ||
        !Number.isFinite(item.lat) ||
        !Number.isFinite(item.lng)
      ) {
        continue;
      }
      order += 1;
      const point: MapPoint = {
        key: `${day.day}-${itemIndex}`,
        day: day.day,
        order,
        title: item.title,
        time: item.time,
        lat: item.lat,
        lng: item.lng,
      };
      if (item.placeId) point.placeId = item.placeId;
      if (item.kind) point.kind = item.kind;
      if (typeof item.hoursKnown === "boolean") {
        point.hoursKnown = item.hoursKnown;
      }
      out.push(point);
    }
  }
  return out;
}

export function boundsOf(
  points: MapPoint[]
): { north: number; south: number; east: number; west: number } | null {
  if (!points.length) return null;
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;
  for (const p of points) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  if (!Number.isFinite(north)) return null;
  return { north, south, east, west };
}
