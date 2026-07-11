import { NextResponse } from "next/server";
import type { OnboardingForm, TravelStyle } from "@/components/onboarding/types";
import {
  isFlexibleScheduleValid,
  normalizeFlexibleYear,
} from "@/components/onboarding/types";
import {
  buildFallbackTripPlan,
  enrichTripPlanWithAi,
} from "@/lib/ai/generate-plan";
import type { TripRecommendation } from "@/lib/ai/types";

export const maxDuration = 300;

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

function isValidForm(form: OnboardingForm): boolean {
  if (!form.budget || !form.origin?.trim() || !form.destination?.trim()) {
    return false;
  }
  if (!Number.isFinite(form.people) || form.people < 1) return false;
  if (!Array.isArray(form.styles) || form.styles.length === 0) return false;
  if (!form.styles.every((s) => VALID_STYLES.includes(s))) return false;
  if (form.dateType === "specific") {
    return Boolean(form.startDate && form.endDate);
  }
  return isFlexibleScheduleValid(form.flexibleMonth, form.flexibleYear);
}

function normalizeForm(form: OnboardingForm): OnboardingForm {
  return {
    ...form,
    flexibleYear: normalizeFlexibleYear(form.flexibleYear),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      form?: OnboardingForm;
      plan?: TripRecommendation;
    };

    const form = body.form ? normalizeForm(body.form) : null;
    if (!form || !isValidForm(form)) {
      return NextResponse.json({ error: "invalid-form" }, { status: 400 });
    }

    const fallback =
      body.plan && body.plan.form
        ? { ...body.plan, form }
        : buildFallbackTripPlan(form);

    const plan = await enrichTripPlanWithAi(fallback);

    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ error: "enrich-failed" }, { status: 500 });
  }
}
