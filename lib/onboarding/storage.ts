import type { OnboardingForm } from "@/components/onboarding/types";
import type { TripRecommendation } from "@/lib/ai/types";
import { STORAGE_KEYS } from "@/lib/constants";

const FORM_KEY = STORAGE_KEYS.onboardingForm;
const PLAN_KEY = STORAGE_KEYS.tripPlan;

export function saveOnboardingForm(form: OnboardingForm): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(FORM_KEY, JSON.stringify(form));
}

export function loadOnboardingForm(): OnboardingForm | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FORM_KEY);
    return raw ? (JSON.parse(raw) as OnboardingForm) : null;
  } catch {
    return null;
  }
}

export function saveTripPlan(plan: TripRecommendation): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

export function loadTripPlan(): TripRecommendation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PLAN_KEY);
    return raw ? (JSON.parse(raw) as TripRecommendation) : null;
  } catch {
    return null;
  }
}
