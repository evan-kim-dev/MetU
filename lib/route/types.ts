/** Shared types for genetic route optimization. */

export type LatLng = {
  lat: number;
  lng: number;
};

export type RoutePoint = LatLng & {
  /** original schedule item index within the day */
  index: number;
  title: string;
  /** fixed anchors (check-in/out, flights) stay in place */
  fixed: boolean;
};

export type GeneticOptimizeOptions = {
  populationSize?: number;
  generations?: number;
  mutationRate?: number;
  eliteCount?: number;
  seed?: number;
};

export type DayRouteOptimizeResult = {
  day: number;
  order: number[];
  totalKmBefore: number;
  totalKmAfter: number;
  optimized: boolean;
};

export type ScheduleOptimizeResult = {
  applied: boolean;
  method: "genetic";
  savedKm: number;
  totalKmBefore: number;
  totalKmAfter: number;
  days: DayRouteOptimizeResult[];
};
