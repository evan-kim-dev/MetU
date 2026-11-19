"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoBack } from "@/lib/navigation/useGoBack";
import { PrimaryFooter, ScreenHeader } from "@/components/ds";
import { BudgetKeypadStep } from "@/components/onboarding/BudgetKeypadStep";
import { ConfirmPlanStep } from "@/components/onboarding/ConfirmPlanStep";
import { AIThinkingOverlay } from "@/components/onboarding/AIThinkingOverlay";
import {
  isFlexibleScheduleValid,
  type OnboardingForm,
} from "@/lib/onboarding/types";
import {
  isKangwonUniversityDestination,
  KANGWON_GRAD_ADMISSION_URL,
} from "@/lib/easter/kangwon-univ";
import {
  clearTravelDraft,
  emptyTravelDraft,
  loadTravelDraft,
  saveTravelDraft,
} from "@/lib/onboarding/travel-draft";
import { parseBudgetAmount } from "@/lib/ai/budget-insight";
import { useAuth } from "@/lib/auth/AuthProvider";

const TOTAL_STEPS = 2;

/** 한 줄 NL에서 목적지 힌트를 골라요. 쉼표/조사 앞 토큰 우선. */
function hintDestination(freeText: string): string {
  const raw = freeText.trim();
  if (!raw) return "";
  const first = raw.split(/[,，\s]/)[0]?.trim() ?? "";
  return first.slice(0, 40);
}

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goBack = useGoBack("/");
  const { isReady, isLoggedIn, provider } = useAuth();
  const restored = useMemo(() => loadTravelDraft() ?? emptyTravelDraft(), []);
  const [step, setStep] = useState(() => Math.min(TOTAL_STEPS, restored.step));
  const [form, setForm] = useState(restored.form);
  const [freeText, setFreeText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!isLoggedIn || provider === "guest") {
      router.replace(
        `/login?next=${encodeURIComponent("/onboarding")}`
      );
    }
  }, [isReady, isLoggedIn, provider, router]);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "plan") {
      setSubmitError("일정 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
      router.replace("/onboarding", { scroll: false });
    }
  }, [router, searchParams]);

  useEffect(() => {
    saveTravelDraft({ step, form });
  }, [step, form]);

  const canProceed = useMemo(() => {
    if (step === 1) return parseBudgetAmount(form.budget) > 0;
    if (step === 2) {
      const dest =
        form.destination.trim() || hintDestination(freeText);
      if (!dest) return false;
      if (form.people < 1) return false;
      if (form.styles.length === 0) return false;
      if (form.dateType === "specific") {
        return form.startDate.length > 0 && form.endDate.length > 0;
      }
      return isFlexibleScheduleValid(form.flexibleMonth, form.flexibleYear);
    }
    return false;
  }, [step, form, freeText]);

  const proceedHint = useMemo(() => {
    if (step !== 2 || canProceed) return undefined;
    const dest = form.destination.trim() || hintDestination(freeText);
    if (!dest) return "목적지를 골라 주세요";
    if (form.styles.length === 0) return "여행 스타일을 하나 이상 골라 주세요";
    if (form.dateType === "specific") {
      if (!form.startDate || !form.endDate) return "출발·귀국 날짜를 선택해 주세요";
    } else if (!isFlexibleScheduleValid(form.flexibleMonth, form.flexibleYear)) {
      return "예정 연·월을 확인해 주세요";
    }
    return undefined;
  }, [step, canProceed, form, freeText]);

  const handleBack = () => {
    if (isSubmitting || showThinking) return;
    if (step > 1) return setStep((s) => s - 1);
    goBack();
  };

  const patchForm = (patch: Partial<OnboardingForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleNext = async () => {
    if (!canProceed) return;

    if (step < TOTAL_STEPS) {
      setSubmitError(null);
      return setStep((s) => s + 1);
    }
    if (isSubmitting) return;

    const destination =
      form.destination.trim() || hintDestination(freeText) || "추천";
    const origin = form.origin.trim() || "서울";

    if (isKangwonUniversityDestination(destination)) {
      window.location.assign(KANGWON_GRAD_ADMISSION_URL);
      return;
    }

    const payload: OnboardingForm = {
      ...form,
      origin,
      destination,
    };

    try {
      setSubmitError(null);
      setIsSubmitting(true);
      setShowThinking(true);

      const res = await fetch("/api/onboarding/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("onboarding-session-save-failed");

      clearTravelDraft();
      router.push("/onboarding/result");
    } catch {
      setShowThinking(false);
      setIsSubmitting(false);
      setSubmitError(
        "저장에 실패했어요. 네트워크 상태를 확인하고 다시 시도해 주세요."
      );
    }
  };

  if (!isReady || !isLoggedIn || provider === "guest") {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-mu-bg">
        <div className="h-10 w-10 animate-pulse rounded-mu-lg bg-mu-accent-soft" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-mu-bg">
      {showThinking && (
        <AIThinkingOverlay
          destination={
            (form.destination.trim() || hintDestination(freeText) || "여행지")
              .split(/[,，]/)[0]
              ?.trim()
          }
        />
      )}

      <ScreenHeader
        title={step === 1 ? "예산" : "일정 확인"}
        left={
          <button
            type="button"
            onClick={handleBack}
            aria-label="뒤로"
            className="mu-focus flex h-11 w-11 items-center justify-center rounded-mu-md text-mu-fg"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        }
        right={
          <span className="text-mu-caption font-medium text-mu-fg-3">
            {step}/{TOTAL_STEPS}
          </span>
        }
      />

      <main className="flex-1 px-5 pb-36 pt-6">
        <p className="sr-only" aria-live="polite">
          {step}/{TOTAL_STEPS} 단계
        </p>
        {step === 1 ? (
          <BudgetKeypadStep
            value={form.budget}
            onChange={(budget) => patchForm({ budget })}
          />
        ) : (
          <ConfirmPlanStep
            form={form}
            freeText={freeText}
            onFreeTextChange={setFreeText}
            onChange={patchForm}
          />
        )}
      </main>

      {submitError ? (
        <p
          role="alert"
          className="fixed inset-x-0 bottom-[5.5rem] z-40 mx-auto w-full max-w-mobile px-5 text-center text-mu-caption font-semibold text-mu-err"
        >
          {submitError}
        </p>
      ) : null}

      <PrimaryFooter
        label={
          isSubmitting
            ? "저장 중…"
            : step === TOTAL_STEPS
              ? "이 예산으로 일정 만들기"
              : "다음"
        }
        onClick={() => {
          void handleNext();
        }}
        disabled={!canProceed || isSubmitting}
        loading={isSubmitting}
        hint={proceedHint}
      />
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 items-center justify-center bg-mu-bg">
          <div className="h-10 w-10 animate-pulse rounded-mu-lg bg-mu-accent-soft" />
        </div>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}
