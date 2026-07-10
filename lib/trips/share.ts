import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/constants";
import type { Trip } from "./types";

interface SharedTripRow {
  id: string;
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

function sharedTripRowToTrip(row: SharedTripRow): Trip {
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

export async function ensureTripShareToken(
  supabase: SupabaseClient,
  userId: string,
  tripId: string
): Promise<string | null> {
  const { data: existing, error: readError } = await supabase
    .from(TABLES.trips)
    .select("share_token")
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError || !existing) return null;
  if (existing.share_token) return existing.share_token;

  const token = crypto.randomUUID();
  const { data: updated, error: updateError } = await supabase
    .from(TABLES.trips)
    .update({ share_token: token })
    .eq("id", tripId)
    .eq("user_id", userId)
    .select("share_token")
    .single();

  if (updateError || !updated?.share_token) return null;
  return updated.share_token;
}

export async function fetchSharedTrip(
  supabase: SupabaseClient,
  token: string
): Promise<Trip | null> {
  const { data, error } = await supabase.rpc("get_shared_trip", {
    p_token: token,
  });

  if (error || !data || typeof data !== "object") return null;
  return sharedTripRowToTrip(data as SharedTripRow);
}

export function cloneSharedTripForAdd(trip: Trip): Trip {
  return {
    ...trip,
    id: crypto.randomUUID(),
    spent: 0,
    status: "upcoming",
    expenses: trip.expenses.map((expense) => ({
      ...expense,
      id: crypto.randomUUID(),
    })),
    budgetAllocation: trip.budgetAllocation?.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    })),
  };
}

export function buildSharedTripUrl(token: string): string {
  if (typeof window === "undefined") return `/trips/share/${token}`;
  return `${window.location.origin}/trips/share/${token}`;
}
