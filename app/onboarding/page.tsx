"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGoBack } from "@/lib/navigation/useGoBack";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { BudgetStep } from "@/components/onboarding/BudgetStep";
import { PartyStep } from "@/components/onboarding/PartyStep";
import { ScheduleStep } from "@/components/onboarding/ScheduleStep";
import { StyleStep } from "@/components/onboarding/StyleStep";
import { AIThinkingOverlay } from "@/components/onboarding/AIThinkingOverlay";
import { INITIAL_FORM, isFlexibleScheduleValid, type TravelStyle } from "@/components/onboarding/types";

const TOTAL_STEPS = 4;
const THINKING_MIN_MS = 2200;

export default function OnboardingPage() {
  const router = useRouter();
  const goBack = useGoBack("/");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

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
    if (step < TOTAL_STEPS) return setStep((s) => s + 1);
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setShowThinking(true);
      const startedAt = Date.now();

      const res = await fetch("/api/onboarding/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("onboarding-session-save-failed");

      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, THINKING_MIN_MS - elapsed);
      if (wait > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, wait));
      }

      router.push("/onboarding/result");
    } catch {
      setShowThinking(false);
      setIsSubmitting(false);
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
        <PrimaryButton
          onClick={handleNext}
          disabled={!canProceed || isSubmitting}
        >
          {isSubmitting
            ? "AI가 생각 중..."
            : step === TOTAL_STEPS
              ? "완료하고 추천 받기"
              : "다음"}
        </PrimaryButton>
      </footer>
    </div>
  );
}
