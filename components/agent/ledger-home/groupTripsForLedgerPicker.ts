import type { Trip } from "@/lib/trips/types";

function byStartAsc(a: Trip, b: Trip): number {
  const as = a.startDate ?? "";
  const bs = b.startDate ?? "";
  if (as && bs && as !== bs) return as.localeCompare(bs);
  if (as && !bs) return -1;
  if (!as && bs) return 1;
  return a.destination.localeCompare(b.destination, "ko");
}

/**
 * 가계부 진입용 여행 묶음.
 * 여행 중은 강조, 예정·이전은 출발일 오름차순(이전→지금)으로 한눈에 보이게 해요.
 */
export function groupTripsForLedgerPicker(trips: Trip[]): {
  ongoing: Trip[];
  upcoming: Trip[];
  completed: Trip[];
} {
  return {
    ongoing: trips.filter((t) => t.status === "ongoing").sort(byStartAsc),
    upcoming: trips.filter((t) => t.status === "upcoming").sort(byStartAsc),
    completed: trips.filter((t) => t.status === "completed").sort(byStartAsc),
  };
}
