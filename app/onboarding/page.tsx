"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoBack } from "@/lib/navigation/useGoBack";
import { Stepper, type StepItem } from "@/components/ds/Stepper";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { BudgetStep } from "@/components/onboarding/BudgetStep";
import { PartyStep } from "@/components/onboarding/PartyStep";
import { ScheduleStep } from "@/components/onboarding/ScheduleStep";
import { StyleStep } from "@/components/onboarding/StyleStep";
import { AIThinkingOverlay } from "@/components/onboarding/AIThinkingOverlay";
import {
  isFlexibleScheduleValid,
  type TravelStyle,
} from "@/components/onboarding/types";
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

const TOTAL_STEPS = 4;

const STEP_META: { key: string; label: string }[] = [
  { key: "budget", label: "예산" },
  { key: "party", label: "인원" },
  { key: "schedule", label: "일정" },
  { key: "style", label: "스타일" },
];

function stepItems(currentStep: number): StepItem[] {
  return STEP_META.map((meta, i) => {
    const n = i + 1;
    return {
      key: meta.key,
      label: meta.label,
      status: n < currentStep ? "done" : n === currentStep ? "current" : "todo",
    };
  });
}

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goBack = useGoBack("/");
  const restored = useMemo(() => loadTravelDraft() ?? emptyTravelDraft(), []);
  const [step, setStep] = useState(restored.step);
  const [form, setForm] = useState(restored.form);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const toggleStyle = (style: TravelStyle) => {
    setForm((prev) => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style],
    }));
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return form.budget.trim().length > 0;
      case 2:
        return form.people >= 1;
      case 3:
        if (
          form.origin.trim().length === 0 ||
          form.destination.trim().length === 0
        ) {
          return false;
        }
        if (form.dateType === "specific") {
          return form.startDate.length > 0 && form.endDate.length > 0;
        }
        return isFlexibleScheduleValid(form.flexibleMonth, form.flexibleYear);
      case 4:
        return form.styles.length > 0;
      default:
        return false;
    }
  }, [step, form]);

  const handleBack = () => {
    if (isSubmitting || showThinking) return;
    if (step > 1) return setStep((s) => s - 1);
    goBack();
  };

  const handleSelectStep = (key: string) => {
    if (isSubmitting || showThinking) return;
    const idx = STEP_META.findIndex((s) => s.key === key);
    if (idx < 0) return;
    const target = idx + 1;
    // 끝낸 단계로만 되돌아가요(입력 보존).
    if (target < step) setStep(target);
  };

  const handleNext = async () => {
    // 도착지 이스터에그: 강원대학교 → 대학원 입시 모집요강
    if (
      step === 3 &&
      canProceed &&
      isKangwonUniversityDestination(form.destination)
    ) {
      window.location.assign(KANGWON_GRAD_ADMISSION_URL);
      return;
    }

    if (step < TOTAL_STEPS) {
      setSubmitError(null);
      return setStep((s) => s + 1);
    }
    if (isSubmitting) return;

    try {
      setSubmitError(null);
      setIsSubmitting(true);
      setShowThinking(true);

      const res = await fetch("/api/onboarding/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  const currentKey = STEP_META[step - 1]?.key ?? "budget";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {showThinking && (
        <AIThinkingOverlay
          destination={form.destination.split(/[,，]/)[0]?.trim()}
        />
      )}

      <Stepper
        steps={stepItems(step)}
        currentKey={currentKey}
        onSelect={handleSelectStep}
        onBack={handleBack}
        title="여행 계획하기"
        navAriaLabel="여행 계획 단계"
      />

      <main className="flex-1 px-5 pb-28 pt-6">
        <p className="sr-only" aria-live="polite">
          {STEP_META[step - 1]?.label} 단계, {step}/{TOTAL_STEPS}
        </p>
        {step === 1 && (
          <BudgetStep
            value={form.budget}
            onChange={(budget) => setForm((p) => ({ ...p, budget }))}
          />
        )}
        {step === 2 && (
          <PartyStep
            value={form.people}
            budget={form.budget}
            onChange={(people) => setForm((p) => ({ ...p, people }))}
          />
        )}
        {step === 3 && (
          <ScheduleStep
            origin={form.origin}
            destination={form.destination}
            dateType={form.dateType}
            startDate={form.startDate}
            endDate={form.endDate}
            flexibleYear={form.flexibleYear}
            flexibleMonth={form.flexibleMonth}
            budget={form.budget}
            people={form.people}
            onOriginChange={(origin) => setForm((p) => ({ ...p, origin }))}
            onDestinationChange={(destination) =>
              setForm((p) => ({ ...p, destination }))
            }
            onDateTypeChange={(dateType) =>
              setForm((p) => ({
                ...p,
                dateType,
                startDate: dateType === "specific" ? p.startDate : "",
                endDate: dateType === "specific" ? p.endDate : "",
              }))
            }
            onStartDateChange={(startDate) =>
              setForm((p) => ({
                ...p,
                startDate,
                endDate: p.endDate && p.endDate < startDate ? "" : p.endDate,
              }))
            }
            onEndDateChange={(endDate) => setForm((p) => ({ ...p, endDate }))}
            onFlexibleYearChange={(flexibleYear) =>
              setForm((p) => {
                const now = new Date();
                let flexibleMonth = p.flexibleMonth;
                if (
                  flexibleYear === now.getFullYear() &&
                  flexibleMonth < now.getMonth() + 1
                ) {
                  flexibleMonth = now.getMonth() + 1;
                }
                return { ...p, flexibleYear, flexibleMonth };
              })
            }
            onFlexibleMonthChange={(flexibleMonth) =>
              setForm((p) => ({ ...p, flexibleMonth }))
            }
          />
        )}
        {step === 4 && (
          <StyleStep selected={form.styles} onToggle={toggleStyle} />
        )}
      </main>

      <footer className="sticky bottom-0 z-30 border-t border-line-soft/60 bg-surface-white/90 px-5 py-4 backdrop-blur-md">
        {submitError ? (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-center text-xs font-semibold leading-relaxed text-danger"
          >
            {submitError}
          </p>
        ) : null}
        <PrimaryButton
          onClick={handleNext}
          disabled={!canProceed || isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting
            ? "AI가 생각 중…"
            : step === TOTAL_STEPS
              ? "완료하고 추천 받기"
              : "다음"}
        </PrimaryButton>
      </footer>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-brand/15" />
        </div>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}
