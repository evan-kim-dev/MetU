"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

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
  const [expanded, setExpanded] = useState(true);

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
      <p role="status" className="text-sm font-semibold text-mu-fg">
        준비 끝! 이제 알림이 오면 자동으로 기록돼요.
      </p>
    );
  }

  function onDismiss() {
    markFirstRunDismissed();
    setDismissed(true);
  }

  /** 글자 수와 무관하게 같은 너비·높이 CTA */
  const ctaClass = (emphasize: boolean) =>
    [
      "mu-focus inline-flex h-11 w-[5.5rem] shrink-0 items-center justify-center rounded-mu-lg px-2 text-center text-sm font-bold",
      emphasize
        ? "bg-mu-accent text-mu-on-accent"
        : "bg-mu-sunken text-mu-accent",
    ].join(" ");

  const rowClass =
    "grid min-h-14 grid-cols-[1.5rem_minmax(0,1fr)_5.5rem] items-center gap-3";

  return (
    <>
      <section
        aria-label="첫 설정"
        className="rounded-mu-xl border border-mu-line bg-mu-card p-4"
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mu-focus flex w-full items-center gap-3 rounded-mu-md text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-mu-body font-bold text-mu-fg">첫 설정</h2>
              <span className="text-mu-caption font-semibold text-mu-fg-2">
                {doneCount}/3
              </span>
            </div>
            {expanded ? (
              <p className="mt-1 text-mu-caption text-mu-fg-3">
                알림 연결 → 여행 → 지출 순서로 준비해요.
              </p>
            ) : (
              <p className="mt-1 text-mu-caption text-mu-fg-3">
                눌러서 이어서 준비하기
              </p>
            )}
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={doneCount}
              aria-label="첫 설정 진행도"
              className="mt-2 h-2 overflow-hidden rounded-full bg-mu-sunken"
            >
              <div
                className="h-full rounded-full bg-mu-accent transition-[width] motion-reduce:transition-none"
                style={{ width: `${(doneCount / 3) * 100}%` }}
              />
            </div>
          </div>
          <span
            aria-hidden
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center text-mu-fg-2 transition-transform duration-mu-fast",
              expanded ? "rotate-180" : "rotate-0",
            ].join(" ")}
          >
            <ChevronDown className="h-5 w-5" strokeWidth={2.2} />
          </span>
        </button>

        {expanded ? (
        <ul className="mt-3 flex flex-col gap-2">
          <li
            className={rowClass}
            aria-label={
              connectStep.done
                ? "카드 알림 자동 기록 연결, 완료"
                : "카드 알림 자동 기록 연결"
            }
          >
            <StepDot done={connectStep.done} />
            <div className="min-w-0">
              <p className="text-mu-label font-bold text-mu-fg">
                카드 알림 자동 기록
              </p>
              {connectStep.done ? (
                <p className="mt-0.5 text-mu-caption text-mu-fg-2">연결됐어요</p>
              ) : effectiveUi === "unverified" ? (
                <p className="mt-0.5 text-mu-caption text-mu-fg-2">
                  연결을 마저 확인해 주세요
                </p>
              ) : (
                <p className="mt-0.5 text-mu-caption text-mu-fg-2">
                  결제 알림이 오면 가계부에 자동으로 적혀요
                </p>
              )}
              {statusFailed && !connectStep.done ? (
                <p className="mt-0.5 text-mu-caption text-mu-fg-2">
                  상태를 불러오지 못했어요.
                </p>
              ) : null}
            </div>
            {!connectStep.done ? (
              <Link
                href="/onboarding/automation"
                className={ctaClass(firstIncomplete === "connect")}
              >
                {effectiveUi === "unverified" ? "이어하기" : "연결하기"}
              </Link>
            ) : (
              <span aria-hidden className="w-[5.5rem]" />
            )}
          </li>

          <li
            className={rowClass}
            aria-label={
              tripStep.done ? "첫 여행 만들기, 완료" : "첫 여행 만들기"
            }
          >
            <StepDot done={tripStep.done} />
            <div className="min-w-0">
              <p className="text-mu-label font-bold text-mu-fg">첫 여행 만들기</p>
              {tripStep.done ? (
                <p className="mt-0.5 text-mu-caption text-mu-fg-2">
                  {primaryTrip?.destination ?? "여행"} 여행이 있어요
                </p>
              ) : (
                <p className="mt-0.5 text-mu-caption text-mu-fg-2">
                  알림·지출을 담을 여행을 만들어요
                </p>
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
            ) : (
              <span aria-hidden className="w-[5.5rem]" />
            )}
          </li>

          {!tripStep.done ? (
            <li className="pl-9">
              <Link
                href="/onboarding"
                className="mu-focus inline-flex min-h-11 items-center text-mu-caption font-semibold text-mu-accent"
              >
                AI로 일정까지 계획하기
              </Link>
            </li>
          ) : null}

          <li
            className={rowClass}
            aria-label={
              expenseStep.done
                ? "첫 지출 기록하기, 완료"
                : "첫 지출 기록하기"
            }
          >
            <StepDot done={expenseStep.done} />
            <div className="min-w-0">
              <p className="text-mu-label font-bold text-mu-fg">
                첫 지출 기록하기
              </p>
              {expenseStep.done ? (
                <p className="mt-0.5 text-mu-caption text-mu-fg-2">
                  지출이 기록됐어요
                </p>
              ) : !primaryTrip ? (
                <p className="mt-0.5 text-mu-caption text-mu-fg-2">
                  여행을 만든 뒤 기록할 수 있어요
                </p>
              ) : (
                <p className="mt-0.5 text-mu-caption text-mu-fg-2">
                  알림 자동 기록이나 직접 입력 모두 좋아요
                </p>
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
                  className="inline-flex h-11 w-[5.5rem] shrink-0 items-center justify-center rounded-mu-lg bg-mu-sunken px-2 text-sm font-bold text-mu-fg-3 disabled:opacity-60"
                >
                  기록하기
                </button>
              )
            ) : (
              <span aria-hidden className="w-[5.5rem]" />
            )}
          </li>
        </ul>
        ) : null}

        {expanded ? (
          <div className="mt-3 flex justify-end border-t border-mu-line pt-2">
            <button
              type="button"
              onClick={onDismiss}
              className="mu-focus inline-flex min-h-11 items-center px-1 text-mu-caption font-medium text-mu-fg-3"
            >
              다시 보지 않기
            </button>
          </div>
        ) : null}
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
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
        done
          ? "bg-mu-ok text-mu-on-accent"
          : "border-2 border-mu-line bg-mu-card",
      ].join(" ")}
    >
      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </span>
  );
}
