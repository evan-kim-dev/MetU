import { NextResponse } from "next/server";
import type { OnboardingForm } from "@/components/onboarding/types";
import { generateTripPlan } from "@/lib/ai/generate-plan";

export async function POST(request: Request) {
  try {
    const form = (await request.json()) as OnboardingForm;

    if (
      !form.budget ||
      !form.origin?.trim() ||
      !form.destination?.trim() ||
      form.people < 1 ||
      form.styles.length === 0
    ) {
      return NextResponse.json(
        { error: "필수 입력 항목이 누락되었습니다." },
        { status: 400 }
      );
    }

    const plan = generateTripPlan(form);
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json(
      { error: "여행 계획 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
