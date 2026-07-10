import { NextResponse } from "next/server";
import type { OnboardingForm, TravelStyle } from "@/components/onboarding/types";
import { isFlexibleScheduleValid } from "@/components/onboarding/types";

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
  if (!form.budget || !form.origin?.trim() || !form.destination?.trim()) return false;
  if (!Number.isFinite(form.people) || form.people < 1) return false;
  if (form.styles.length === 0) return false;
  if (!form.styles.every((s) => VALID_STYLES.includes(s))) return false;
  if (form.dateType === "specific") {
    return Boolean(form.startDate && form.endDate);
  }
  return isFlexibleScheduleValid(form.flexibleMonth, form.flexibleYear);
}

export async function POST(request: Request) {
  try {
    const form = (await request.json()) as OnboardingForm;
    if (!isValidForm(form)) {
      return NextResponse.json({ error: "invalid-form" }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("onboarding-form", JSON.stringify(form), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }
}
