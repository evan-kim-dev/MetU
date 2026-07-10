import { RecommendResult } from "@/components/recommend/RecommendResult";
import type { OnboardingForm, TravelStyle } from "@/components/onboarding/types";
import {
  isFlexibleScheduleValid,
  normalizeFlexibleYear,
} from "@/components/onboarding/types";
import { generateTripPlan } from "@/lib/ai/generate-plan";
import { createServerSupabase } from "@/lib/supabase/server";
import { insertTripPlanToSupabase } from "@/lib/trips/plans-supabase";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const VALID_STYLES: TravelStyle[] = [
  "healing",
  "sightseeing",
  "food",
  "shopping",
  "activity",
  "culture",
  "nature",
  "hotplace",
  "shopping-mall",
];

function parseFormFromCookie(raw: string): OnboardingForm | null {
  try {
    const decoded = raw.startsWith("%7B") ? decodeURIComponent(raw) : raw;
    const form = JSON.parse(decoded) as OnboardingForm;
    if (!form.budget || !form.origin?.trim() || !form.destination?.trim()) return null;
    if (!Number.isFinite(form.people) || form.people < 1) return null;
    if (!Array.isArray(form.styles) || form.styles.length === 0) return null;
    if (!form.styles.every((s) => VALID_STYLES.includes(s))) return null;
    if (form.dateType === "specific") {
      if (!form.startDate || !form.endDate) return null;
    } else if (!isFlexibleScheduleValid(form.flexibleMonth, form.flexibleYear)) {
      return null;
    }
    form.flexibleYear = normalizeFlexibleYear(form.flexibleYear);
    return form;
  } catch {
    return null;
  }
}

export default async function RecommendPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("onboarding-form")?.value;
  const form = raw ? parseFormFromCookie(raw) : null;
  if (!form) {
    redirect("/onboarding");
  }

  let plan;
  try {
    plan = await generateTripPlan(form);
  } catch {
    redirect("/onboarding?error=plan");
  }

  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await insertTripPlanToSupabase(supabase, user.id, form, plan);
    }
  } catch {
    // Auth/DB 실패해도 추천 결과는 보여준다.
  }

  return <RecommendResult plan={plan} />;
}
