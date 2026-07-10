import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/constants";
import type { Trip, TripUpdate } from "./types";

interface TripRow {
  id: string;
  user_id: string;
  destination: string;
  country: string;
  origin: string;
  date_range: string;
  d_day: number;
  budget: number;
  spent: number;
  people: number;
  styles: string[];
  image_url: string;
  memo: string | null;
  status: Trip["status"];
  budget_allocation: Trip["budgetAllocation"];
  daily_schedule: Trip["dailySchedule"];
  tips: string[];
  expenses: Trip["expenses"];
}

const TRIP_COLUMNS = [
  "id",
  "user_id",
  "destination",
  "country",
  "origin",
  "date_range",
  "d_day",
  "budget",
  "spent",
  "people",
  "styles",
  "image_url",
  "memo",
  "status",
  "budget_allocation",
  "daily_schedule",
  "tips",
  "expenses",
].join(", ");

function rowToTrip(row: TripRow): Trip {
  return {
    id: row.id,
    destination: row.destination,
    country: row.country,
    origin: row.origin,
    dateRange: row.date_range,
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

function tripToRow(trip: Trip, userId: string): Omit<TripRow, "id"> & { id?: string } {
  return {
    id: trip.id,
    user_id: userId,
    destination: trip.destination,
    country: trip.country,
    origin: trip.origin,
    date_range: trip.dateRange,
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

function updateToRow(update: TripUpdate): Partial<TripRow> {
  const row: Partial<TripRow> = {};
  if (update.destination !== undefined) row.destination = update.destination;
  if (update.country !== undefined) row.country = update.country;
  if (update.origin !== undefined) row.origin = update.origin;
  if (update.dateRange !== undefined) row.date_range = update.dateRange;
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

export async function fetchTripsFromSupabase(
  supabase: SupabaseClient,
  userId: string
): Promise<Trip[]> {
  const { data, error } = await supabase
    .from(TABLES.trips)
    .select(TRIP_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as TripRow[]).map(rowToTrip);
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
    .select(TRIP_COLUMNS)
    .single();

  if (error || !data) return null;
  return rowToTrip(data as unknown as TripRow);
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
    .select(TRIP_COLUMNS)
    .single();

  if (error || !data) return null;
  return rowToTrip(data as unknown as TripRow);
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
    .select(TRIP_COLUMNS);
  if (error || !data) return [];
  return (data as unknown as TripRow[]).map(rowToTrip);
}
