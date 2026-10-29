import type { MapPoint } from "@/lib/map/trip-points";
import type { TripDaySchedule } from "@/lib/trips/types";

export interface TripMapProps {
  days: TripDaySchedule[];
  selectedDay: number | "all";
  highlightKey?: string;
  onSelectPoint?: (point: MapPoint) => void;
  /** Step 5-C: placeId → KRW 합계 */
  spendByPlaceId?: Record<string, number>;
  draggableMarkers?: boolean;
  onMarkerDragEnd?: (
    point: MapPoint,
    next: { lat: number; lng: number }
  ) => void;
  className?: string;
  /** 지역 판별용 (TripMap 파사드에서 사용) */
  country?: string;
  destination?: string;
}
