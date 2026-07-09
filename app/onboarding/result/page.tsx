import { RecommendResult } from "@/components/recommend/RecommendResult";
import type { OnboardingForm, TravelStyle } from "@/components/onboarding/types";
import { generateTripPlan } from "@/lib/ai/generate-plan";
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
    } else if (!(form.flexibleMonth >= 1 && form.flexibleMonth <= 12)) {
      return null;
    }
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
  const plan = generateTripPlan(form);

  return <RecommendResult plan={plan} />;
}
