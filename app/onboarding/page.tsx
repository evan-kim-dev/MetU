"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoBack } from "@/lib/navigation/useGoBack";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { BudgetStep } from "@/components/onboarding/BudgetStep";
import { PartyStep } from "@/components/onboarding/PartyStep";
import { ScheduleStep } from "@/components/onboarding/ScheduleStep";
import { StyleStep } from "@/components/onboarding/StyleStep";
import { AIThinkingOverlay } from "@/components/onboarding/AIThinkingOverlay";
import {
  INITIAL_FORM,
  isFlexibleScheduleValid,
  type TravelStyle,
} from "@/components/onboarding/types";

const TOTAL_STEPS = 4;

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goBack = useGoBack("/");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
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

  const handleNext = async () => {
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

      router.push("/onboarding/result");
    } catch {
      setShowThinking(false);
      setIsSubmitting(false);
      setSubmitError(
        "저장에 실패했어요. 네트워크 상태를 확인하고 다시 시도해 주세요."
      );
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {showThinking && (
        <AIThinkingOverlay
          destination={form.destination.split(/[,，]/)[0]?.trim()}
        />
      )}

      <TopAppBar
        title="여행 계획하기"
        showBack
        backHref="/"
        onBack={handleBack}
      />

      <div className="sticky top-14 z-30 border-b border-line-soft/60 bg-surface-base/90 px-5 py-3 backdrop-blur-md">
        <ProgressBar current={step} total={TOTAL_STEPS} />
      </div>

      <main className="flex-1 px-5 pb-28 pt-6">
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
