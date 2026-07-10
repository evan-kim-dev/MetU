import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingForm } from "@/components/onboarding/types";
import type { TripRecommendation } from "@/lib/ai/types";
import { TABLES } from "@/lib/constants";

export interface TripPlanRecord {
  id: string;
  userId: string;
  formData: OnboardingForm;
  planData: TripRecommendation;
  createdAt: string;
}

interface TripPlanRow {
  id: string;
  user_id: string;
  form_data: OnboardingForm;
  plan_data: TripRecommendation;
  created_at: string;
}

const TRIP_PLAN_COLUMNS = "id, user_id, form_data, plan_data, created_at";

function rowToTripPlan(row: TripPlanRow): TripPlanRecord {
  return {
    id: row.id,
    userId: row.user_id,
    formData: row.form_data,
    planData: row.plan_data,
    createdAt: row.created_at,
  };
}

export async function insertTripPlanToSupabase(
  supabase: SupabaseClient,
  userId: string,
  form: OnboardingForm,
  plan: TripRecommendation
): Promise<TripPlanRecord | null> {
  const { data, error } = await supabase
    .from(TABLES.tripPlans)
    .insert({
      user_id: userId,
      form_data: form,
      plan_data: plan,
    })
    .select(TRIP_PLAN_COLUMNS)
    .single();

  if (error || !data) {
    console.error("[trip_plans] insert failed:", error?.message);
    return null;
  }

  return rowToTripPlan(data as unknown as TripPlanRow);
}

export async function fetchTripPlansFromSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<TripPlanRecord[]> {
  const { data, error } = await supabase
    .from(TABLES.tripPlans)
    .select(TRIP_PLAN_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown as TripPlanRow[]).map(rowToTripPlan);
}
