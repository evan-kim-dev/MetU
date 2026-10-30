"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { QuickTripSheet } from "@/components/trips/QuickTripSheet";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";
import type { AutomationUiState } from "@/lib/onboarding/automation-ui-state";
import {
  computeFirstRun,
  markFirstRunDismissed,
  markFirstRunDone,
  tripsHaveAnyExpense,
  FIRST_RUN_DISMISSED_KEY,
  FIRST_RUN_DONE_KEY,
} from "@/lib/onboarding/first-run";
import { useTrips } from "@/lib/trips/TripProvider";

function readStorageFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function FirstRunChecklist() {
  const { isReady, isLoggedIn, provider } = useAuth();
  const isGuest = provider === "guest";
  const { trips, isReady: tripsReady, activeTrips } = useTrips();
  const enabled = isReady && isLoggedIn && !isGuest;
  const { uiState, loading, error } = useAutomationStatus({
    enabled,
    lite: true,
  });
  const [dismissed, setDismissed] = useState(false);
  const [doneStored, setDoneStored] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDismissed(readStorageFlag(FIRST_RUN_DISMISSED_KEY));
    setDoneStored(readStorageFlag(FIRST_RUN_DONE_KEY));
    setHydrated(true);
  }, []);

  const effectiveUi: AutomationUiState =
    error || !uiState ? "off" : uiState;
  const statusFailed = Boolean(error);

  const { steps, doneCount, allDone } = useMemo(
    () =>
      computeFirstRun({
        uiState: effectiveUi,
        hasActiveTrip: activeTrips.length > 0,
        hasAnyExpense: tripsHaveAnyExpense(trips),
      }),
    [effectiveUi, activeTrips.length, trips]
  );

  useEffect(() => {
    // Persist for the next visit; keep the completion line visible this session.
    if (!allDone || dismissed) return;
    markFirstRunDone();
  }, [allDone, dismissed]);

  if (!enabled || !hydrated || !tripsReady || loading) return null;
  if (dismissed || doneStored) return null;

  const firstIncomplete = steps.find((s) => !s.done)?.id ?? null;
  const primaryTrip = activeTrips[0] ?? trips[0];
  const connectStep = steps.find((s) => s.id === "connect")!;
  const tripStep = steps.find((s) => s.id === "trip")!;
  const expenseStep = steps.find((s) => s.id === "expense")!;

  if (allDone) {
    return (
      <p role="status" className="text-sm font-semibold text-ink-heading">
        준비 끝! 이제 알림이 오면 자동으로 기록돼요. 🎉
      </p>
    );
  }

  function onDismiss() {
    markFirstRunDismissed();
    setDismissed(true);
  }

  const ctaClass = (emphasize: boolean) =>
    [
      "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
      emphasize
        ? "ai-gradient-bg text-surface-white"
        : "bg-surface-soft text-brand",
    ].join(" ");

  return (
    <>
      <section
        aria-label="시작하기"
        className="rounded-2xl bg-surface-white p-4 shadow-sm ring-1 ring-line-soft"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-extrabold text-ink-heading">
                시작하기
              </h2>
              <span className="text-sm font-bold text-ink-body">
                {doneCount}/3
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={doneCount}
              aria-label="시작하기 진행도"
              className="mt-2 h-2 overflow-hidden rounded-full bg-surface-soft"
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] motion-reduce:transition-none"
                style={{ width: `${(doneCount / 3) * 100}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-sm font-semibold text-ink-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            숨기기
          </button>
        </div>

        <ul className="mt-3 flex flex-col gap-2">
          <li
            className="flex min-h-[56px] items-start gap-3"
            aria-label={
              connectStep.done
                ? "카드 알림 자동 기록 연결, 완료"
                : "카드 알림 자동 기록 연결"
            }
          >
            <StepDot done={connectStep.done} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink-heading">
                카드 알림 자동 기록 연결
              </p>
              {connectStep.done ? (
                <p className="mt-0.5 text-xs text-ink-body">연결됐어요</p>
              ) : effectiveUi === "unverified" ? (
                <p className="mt-0.5 text-xs text-ink-body">
                  연결을 마저 확인해 주세요
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-ink-body">
                  결제 알림이 오면 가계부에 자동으로 적혀요 · 약 5분
                </p>
              )}
              {statusFailed && !connectStep.done ? (
                <p className="mt-0.5 text-xs text-ink-body">
                  상태를 불러오지 못했어요.
                </p>
              ) : null}
            </div>
            {!connectStep.done ? (
              <Link
                href="/onboarding/automation"
                className={ctaClass(firstIncomplete === "connect")}
              >
                {effectiveUi === "unverified" ? "이어서 하기" : "연결하기"}
              </Link>
            ) : null}
          </li>

          <li
            className="flex min-h-[56px] items-start gap-3"
            aria-label={
              tripStep.done ? "첫 여행 만들기, 완료" : "첫 여행 만들기"
            }
          >
            <StepDot done={tripStep.done} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink-heading">
                첫 여행 만들기
              </p>
              {tripStep.done ? (
                <p className="mt-0.5 text-xs text-ink-body">
                  {primaryTrip?.destination ?? "여행"} 여행이 있어요
                </p>
              ) : (
                <>
                  <p className="mt-0.5 text-xs text-ink-body">
                    알림과 지출을 담을 여행이에요 · 30초
                  </p>
                  <Link
                    href="/onboarding"
                    className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    AI로 일정까지 계획하기
                  </Link>
                </>
              )}
            </div>
            {!tripStep.done ? (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className={ctaClass(firstIncomplete === "trip")}
              >
                만들기
              </button>
            ) : null}
          </li>

          <li
            className="flex min-h-[56px] items-start gap-3"
            aria-label={
              expenseStep.done
                ? "첫 지출 기록하기, 완료"
                : "첫 지출 기록하기"
            }
          >
            <StepDot done={expenseStep.done} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink-heading">
                첫 지출 기록하기
              </p>
              {expenseStep.done ? (
                <p className="mt-0.5 text-xs text-ink-body">
                  지출이 기록됐어요
                </p>
              ) : (
                <>
                  <p className="mt-0.5 text-xs text-ink-body">
                    알림 자동 기록이나 직접 입력 모두 좋아요
                  </p>
                  {!primaryTrip ? (
                    <p className="mt-0.5 text-xs text-ink-body">
                      먼저 여행을 만들어 주세요.
                    </p>
                  ) : null}
                </>
              )}
            </div>
            {!expenseStep.done ? (
              primaryTrip ? (
                <Link
                  href={`/trips/${primaryTrip.id}/ledger`}
                  className={ctaClass(firstIncomplete === "expense")}
                >
                  기록하기
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-surface-soft px-3 text-sm font-bold text-ink-caption disabled:opacity-60"
                >
                  기록하기
                </button>
              )
            ) : null}
          </li>
        </ul>
      </section>

      <QuickTripSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        reason="first-run"
      />
    </>
  );
}

function StepDot({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
        done
          ? "bg-emerald-500 text-white"
          : "border-2 border-line-muted bg-surface-white",
      ].join(" ")}
    >
      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </span>
  );
}
