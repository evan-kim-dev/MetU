import { RecommendResult } from "@/components/recommend/RecommendResult";
import type { OnboardingForm, TravelStyle } from "@/components/onboarding/types";
import {
  isFlexibleScheduleValid,
  normalizeFlexibleYear,
} from "@/components/onboarding/types";
import { buildFallbackTripPlan } from "@/lib/ai/generate-plan";
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

/** 쿠키 없이 바로 보는 100만·2인 표준 데모 폼 */
function buildDemoForm(destination: string): OnboardingForm {
  return {
    budget: "1000000",
    people: 2,
    origin: "서울",
    destination: destination.trim() || "도쿄",
    dateType: "flexible",
    startDate: "",
    endDate: "",
    flexibleYear: 2026,
    flexibleMonth: 11,
    styles: ["food", "sightseeing"],
  };
}

function parseFormFromCookie(raw: string): OnboardingForm | null {
  try {
    const decoded = raw.startsWith("%7B") ? decodeURIComponent(raw) : raw;
    const form = JSON.parse(decoded) as OnboardingForm;
    if (!form.budget || !form.origin?.trim() || !form.destination?.trim()) {
      return null;
    }
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

interface PageProps {
  searchParams: Promise<{ sample?: string; city?: string }>;
}

export default async function RecommendPage({ searchParams }: PageProps) {
  const { sample, city } = await searchParams;
  const targetCity = (city?.trim() || (sample ? "도쿄" : "")) || null;

  let form: OnboardingForm | null = null;
  if (targetCity) {
    form = buildDemoForm(targetCity);
  } else {
    const cookieStore = await cookies();
    const raw = cookieStore.get("onboarding-form")?.value;
    form = raw ? parseFormFromCookie(raw) : null;
  }

  if (!form) {
    redirect("/onboarding");
  }

  const plan = buildFallbackTripPlan(form);
  return (
    <RecommendResult
      plan={plan}
      enrich
      demoFxExample={Boolean(targetCity)}
    />
  );
}
