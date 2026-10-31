import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/constants";
import { suggestTripDates } from "@/lib/ledger/trip-dates";
import { seoulDateIso } from "@/lib/onboarding/trip-window";
import type { Trip, TripUpdate } from "./types";

interface TripRow {
  id: string;
  user_id: string;
  destination: string;
  country: string;
  origin: string;
  date_range: string;
  start_date?: string | null;
  end_date?: string | null;
  d_day: number;
  budget: number;
  spent: number;
  people: number;
  styles: string[];
  image_url: string;
  memo: string | null;
  status: Trip["status"];
  budget_allocation?: Trip["budgetAllocation"] | null;
  daily_schedule?: Trip["dailySchedule"] | null;
  tips?: string[] | null;
  expenses?: Trip["expenses"] | null;
  created_at?: string | null;
}

/** List/home cards — skip heavy JSON payloads */
const TRIP_LIST_COLUMNS = [
  "id",
  "user_id",
  "destination",
  "country",
  "origin",
  "date_range",
  "start_date",
  "end_date",
  "d_day",
  "budget",
  "spent",
  "people",
  "styles",
  "image_url",
  "memo",
  "status",
  "created_at",
].join(", ");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * trips.start_date / end_date 로 저장할 값.
 * 확정된 ISO(startDate)가 있으면 그것을, 없으면 date_range 에서 추정한다.
 * 해석에 실패하면 둘 다 null (틀린 날짜를 지어내지 않는다).
 * "오늘" 은 Asia/Seoul 기준이다 (서버/브라우저 UTC 에 흔들리지 않게).
 */
export function tripDateColumns(
  input: {
    dateRange: string;
    startDate?: string | null;
    endDate?: string | null;
  },
  today: string = seoulDateIso(new Date())
): { start_date: string | null; end_date: string | null } {
  const explicitStart =
    input.startDate && ISO_DATE.test(input.startDate) ? input.startDate : null;
  if (explicitStart) {
    const explicitEnd =
      input.endDate &&
      ISO_DATE.test(input.endDate) &&
      input.endDate >= explicitStart
        ? input.endDate
        : explicitStart;
    return { start_date: explicitStart, end_date: explicitEnd };
  }
  const suggested = suggestTripDates(input.dateRange, today);
  if (!suggested) return { start_date: null, end_date: null };
  return { start_date: suggested.startDate, end_date: suggested.endDate };
}

/** Detail / mutate responses — full trip document */
const TRIP_DETAIL_COLUMNS = [
  TRIP_LIST_COLUMNS,
  "budget_allocation",
  "daily_schedule",
  "tips",
  "expenses",
].join(", ");

function rowToTrip(row: TripRow, userId: string): Trip {
  return {
    id: row.id,
    isOwner: row.user_id === userId,
    destination: row.destination,
    country: row.country,
    origin: row.origin,
    dateRange: row.date_range,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    dDay: row.d_day,
    budget: Number(row.budget),
    spent: Number(row.spent),
    people: row.people,
    styles: row.styles ?? [],
    imageUrl: row.image_url,
    memo: row.memo ?? undefined,
    status: row.status,
    expenses: row.expenses ?? [],
    budgetAllocation: row.budget_allocation ?? undefined,
    dailySchedule: row.daily_schedule ?? undefined,
    tips: row.tips ?? undefined,
  };
}

export function tripToRow(
  trip: Trip,
  userId: string
): Omit<TripRow, "id"> & { id?: string } {
  return {
    id: trip.id,
    user_id: userId,
    destination: trip.destination,
    country: trip.country,
    origin: trip.origin,
    date_range: trip.dateRange,
    ...tripDateColumns(trip),
    d_day: trip.dDay,
    budget: trip.budget,
    spent: trip.spent,
    people: trip.people,
    styles: trip.styles,
    image_url: trip.imageUrl,
    memo: trip.memo ?? null,
    status: trip.status,
    budget_allocation: trip.budgetAllocation ?? [],
    daily_schedule: trip.dailySchedule ?? [],
    tips: trip.tips ?? [],
    expenses: trip.expenses,
  };
}

export function updateToRow(update: TripUpdate): Partial<TripRow> {
  const row: Partial<TripRow> = {};
  if (update.destination !== undefined) row.destination = update.destination;
  if (update.country !== undefined) row.country = update.country;
  if (update.origin !== undefined) row.origin = update.origin;
  if (update.dateRange !== undefined) row.date_range = update.dateRange;
  if (update.dateRange !== undefined || update.startDate !== undefined) {
    // 날짜 라벨이 바뀌면 컬럼도 같이 갱신 (해석 실패 시 null — 낡은 날짜를 남기지 않는다).
    const cols = tripDateColumns({
      dateRange: update.dateRange ?? "",
      startDate: update.startDate,
      endDate: update.endDate,
    });
    row.start_date = cols.start_date;
    row.end_date = cols.end_date;
  } else if (update.endDate !== undefined) {
    row.end_date =
      update.endDate && ISO_DATE.test(update.endDate) ? update.endDate : null;
  }
  if (update.dDay !== undefined) row.d_day = update.dDay;
  if (update.budget !== undefined) row.budget = update.budget;
  if (update.spent !== undefined) row.spent = update.spent;
  if (update.people !== undefined) row.people = update.people;
  if (update.styles !== undefined) row.styles = update.styles;
  if (update.imageUrl !== undefined) row.image_url = update.imageUrl;
  if (update.memo !== undefined) row.memo = update.memo ?? null;
  if (update.status !== undefined) row.status = update.status;
  if (update.budgetAllocation !== undefined) {
    row.budget_allocation = update.budgetAllocation;
  }
  if (update.dailySchedule !== undefined) row.daily_schedule = update.dailySchedule;
  if (update.tips !== undefined) row.tips = update.tips;
  if (update.expenses !== undefined) row.expenses = update.expenses;
  return row;
}

/**
 * List rows omit heavy JSON. Treat as hydrated once detail fields exist
 * (including empty arrays after a full fetch).
 */
export function isTripDetailHydrated(trip: Trip): boolean {
  return (
    Array.isArray(trip.dailySchedule) ||
    Array.isArray(trip.budgetAllocation) ||
    Array.isArray(trip.tips)
  );
}

function byCreatedAtDesc(a: TripRow, b: TripRow): number {
  return (b.created_at ?? "").localeCompare(a.created_at ?? "");
}

/**
 * 내가 만든 여행 + 내가 멤버로 합류한 여행(공유받음).
 * 멤버 여행은 RLS `trips_select_member` 가 있어야 읽힌다. 정책이 없거나 멤버 조회가
 * 실패하면 내 여행만 돌려준다(로그만 남김).
 */
export async function fetchTripsFromSupabase(
  supabase: SupabaseClient,
  userId: string
): Promise<Trip[]> {
  const { data, error } = await supabase
    .from(TABLES.trips)
    .select(TRIP_LIST_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  const owned = data as unknown as TripRow[];

  const { data: memberRows, error: memberErr } = await supabase
    .from(TABLES.tripMembers)
    .select("trip_id")
    .eq("user_id", userId);
  if (memberErr) {
    console.error("[fetchTripsFromSupabase] members", memberErr.message);
    return owned.map((row) => rowToTrip(row, userId));
  }

  const ownedIds = new Set(owned.map((row) => row.id));
  const sharedIds = [
    ...new Set(
      ((memberRows ?? []) as Array<{ trip_id: string }>)
        .map((r) => r.trip_id)
        .filter((id) => !ownedIds.has(id))
    ),
  ];
  if (sharedIds.length === 0) return owned.map((row) => rowToTrip(row, userId));

  const { data: sharedData, error: sharedErr } = await supabase
    .from(TABLES.trips)
    .select(TRIP_LIST_COLUMNS)
    .in("id", sharedIds);
  if (sharedErr) {
    console.error("[fetchTripsFromSupabase] shared", sharedErr.message);
    return owned.map((row) => rowToTrip(row, userId));
  }

  return [...owned, ...((sharedData ?? []) as unknown as TripRow[])]
    .sort(byCreatedAtDesc)
    .map((row) => rowToTrip(row, userId));
}

/** 내 여행 또는 멤버로 합류한 여행 한 건 (읽기 권한은 RLS 가 정한다). */
export async function fetchTripByIdFromSupabase(
  supabase: SupabaseClient,
  userId: string,
  tripId: string
): Promise<Trip | null> {
  const { data, error } = await supabase
    .from(TABLES.trips)
    .select(TRIP_DETAIL_COLUMNS)
    .eq("id", tripId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToTrip(data as unknown as TripRow, userId);
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

export async function insertTripToSupabase(
  supabase: SupabaseClient,
  userId: string,
  trip: Trip
): Promise<Trip | null> {
  const row = tripToRow(
    isValidUuid(trip.id) ? trip : { ...trip, id: crypto.randomUUID() },
    userId
  );
  const { data, error } = await supabase
    .from(TABLES.trips)
    .insert(row)
    .select(TRIP_DETAIL_COLUMNS)
    .single();

  if (error || !data) return null;
  return rowToTrip(data as unknown as TripRow, userId);
}

export async function updateTripInSupabase(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  update: TripUpdate
): Promise<Trip | null> {
  const row = updateToRow(update);
  const { data, error } = await supabase
    .from(TABLES.trips)
    .update(row)
    .eq("id", id)
    .eq("user_id", userId)
    .select(TRIP_DETAIL_COLUMNS)
    .single();

  if (error || !data) return null;
  return rowToTrip(data as unknown as TripRow, userId);
}

export async function deleteTripFromSupabase(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.trips)
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return !error;
}

export async function upsertTripsToSupabase(
  supabase: SupabaseClient,
  userId: string,
  trips: Trip[]
): Promise<Trip[]> {
  if (trips.length === 0) return [];
  const rows = trips.map((trip) =>
    tripToRow(isValidUuid(trip.id) ? trip : { ...trip, id: crypto.randomUUID() }, userId)
  );
  const { data, error } = await supabase
    .from(TABLES.trips)
    .upsert(rows, { onConflict: "id" })
    .select(TRIP_DETAIL_COLUMNS);
  if (error || !data) return [];
  return (data as unknown as TripRow[]).map((row) => rowToTrip(row, userId));
}
