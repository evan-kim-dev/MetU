"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

import { ConnectError } from "@/components/onboarding/connect/ConnectError";
import { ConnectHub } from "@/components/onboarding/connect/ConnectHub";
import { ConnectStepCards } from "@/components/onboarding/connect/ConnectStepCards";
import { GateNotice } from "@/components/onboarding/connect/GateNotice";
import { RecentEventsStrip } from "@/components/onboarding/connect/RecentEventsStrip";
import { StepAutomation } from "@/components/onboarding/connect/StepAutomation";
import { StepCode } from "@/components/onboarding/connect/StepCode";
import { StepDevice } from "@/components/onboarding/connect/StepDevice";
import { StepShortcut } from "@/components/onboarding/connect/StepShortcut";
import { StepVerify } from "@/components/onboarding/connect/StepVerify";
import { UnsupportedHandoff } from "@/components/onboarding/connect/UnsupportedHandoff";
import { useClipboardCopy } from "@/components/onboarding/connect/useClipboardCopy";
import { apiFetchJson } from "@/lib/api/fetch-json";
import { useAuth } from "@/lib/auth/AuthProvider";
import { resolvePostOnboardingPath } from "@/lib/auth/post-login-path";
import type { UserFacingError } from "@/lib/errors/user-message";
import { toUserFacingError } from "@/lib/errors/user-message";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { detectPlatform } from "@/lib/onboarding/automation";
import { shouldEnterConnectHub } from "@/lib/onboarding/connect-entry";
import {
  connectReducer,
  initialConnectState,
  pickVerifyArrival,
  showConnectStepper,
  toSnapshot,
  type ConnectErrorState,
} from "@/lib/onboarding/connect-machine";
import {
  eventsSince,
  newestRealEvent,
} from "@/lib/onboarding/last-device-event";
import {
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
} from "@/lib/onboarding/connect-storage";
import {
  defaultTokenLabelForPlatform,
  nextTokenLabel,
} from "@/lib/onboarding/token-label";
import { useTrips } from "@/lib/trips/TripProvider";

type TokenRes = {
  token: string;
  id: string;
  createdAt?: string;
  revokedCount?: number;
};

type TokensListRes = {
  tokens: Array<{
    id: string;
    label: string;
    revoked: boolean;
  }>;
};

type TestRes = { ok?: boolean; duplicate?: boolean };

function toConnectError(e: UserFacingError): ConnectErrorState {
  return {
    code: e.code,
    message: e.message,
    retryable: e.retryable,
    retryAfterSec: e.retryAfterSec,
    action: e.action,
    operatorHint: e.operatorHint,
  };
}

export function ConnectFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, provider } = useAuth();
  const isGuest = provider === "guest";
  const online = useOnlineStatus();
  const { activeTrips, trips } = useTrips();
  const [state, dispatch] = useReducer(connectReducer, undefined, () =>
    initialConnectState()
  );
  const [booted, setBooted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [serverTestError, setServerTestError] =
    useState<UserFacingError | null>(null);
  const [waitingMs, setWaitingMs] = useState(0);
  const [pollingStopped, setPollingStopped] = useState(false);
  const [pollEpoch, setPollEpoch] = useState(0);
  const [activeTokenCount, setActiveTokenCount] = useState(0);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const prevPhase = useRef(state.phase);
  const prevEventCount = useRef(0);
  const bootStarted = useRef(false);
  // 서버 시각 - 클라이언트 시각. 연결 확인 기준 시각(verifyStartedAt)을 서버 시계로 맞춰요.
  const clockOffsetMs = useRef(0);
  const { copy } = useClipboardCopy();

  const gate = searchParams.get("gate");
  const nextPath = searchParams.get("next");

  const showStrip =
    state.phase === "code" ||
    state.phase === "shortcut" ||
    state.phase === "automation" ||
    state.phase === "verify";

  const bootStatus = useAutomationStatus({
    enabled: isReady && !isGuest && !booted,
    lite: true,
    cacheTtlMs: 0,
  });

  const status = useAutomationStatus({
    enabled:
      (showStrip &&
        !pollingStopped &&
        !(state.phase === "verify" && state.realOk)) ||
      state.phase === "hub",
    lite: state.phase !== "verify",
    intervalMs: state.phase === "verify" ? 5000 : 10_000,
    cacheTtlMs: 0,
  });

  const refreshTokenMeta = useCallback(async () => {
    const res = await apiFetchJson<TokensListRes>(
      "/api/agent/tokens",
      { method: "GET" },
      { source: "api" }
    );
    if (!res.ok) {
      setActiveTokenCount(0);
      setActiveLabels([]);
      return;
    }
    const active = res.data.tokens.filter((t) => !t.revoked);
    setActiveTokenCount(active.length);
    setActiveLabels(active.map((t) => t.label));
  }, []);

  useEffect(() => {
    if (!isReady || isGuest || bootStarted.current) return;
    const snap = loadSnapshot();
    if (snap && snap.phase !== "hub" && snap.phase !== "done" && snap.phase !== "skipped") {
      bootStarted.current = true;
      dispatch({ type: "RESTORE", snapshot: snap });
      setBooted(true);
      return;
    }
    if (bootStatus.loading) return;
    bootStarted.current = true;
    const platform = detectPlatform(navigator.userAgent);
    const data = bootStatus.data;
    if (
      data &&
      shouldEnterConnectHub({
        hasActiveToken: data.hasActiveToken,
        status: data.status,
      })
    ) {
      const hubPlatform =
        data.platform === "ios" || data.platform === "android"
          ? data.platform
          : platform === "ios" || platform === "android"
            ? platform
            : "ios";
      dispatch({
        type: "ENTER_HUB",
        platform: hubPlatform,
        ios27: hubPlatform === "ios" ? true : null,
      });
      void refreshTokenMeta();
    } else {
      dispatch({ type: "PLATFORM_DETECTED", platform });
    }
    setBooted(true);
  }, [
    isReady,
    isGuest,
    bootStatus.loading,
    bootStatus.data,
    refreshTokenMeta,
  ]);

  useEffect(() => {
    if (!booted) return;
    if (state.phase === "done" || state.phase === "skipped") {
      clearSnapshot();
      return;
    }
    if (state.phase === "device" || state.phase === "hub") return;
    saveSnapshot(toSnapshot(state));
  }, [state, booted]);

  useEffect(() => {
    if (prevPhase.current === state.phase) return;
    prevPhase.current = state.phase;
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }
    const h2 = document.querySelector("h2");
    if (h2 instanceof HTMLElement) h2.focus();
  }, [state.phase]);

  const serverNow = status.data?.serverNow ?? bootStatus.data?.serverNow;
  useEffect(() => {
    if (!serverNow) return;
    const server = Date.parse(serverNow);
    if (Number.isFinite(server)) clockOffsetMs.current = server - Date.now();
  }, [serverNow]);

  const nowIso = useCallback(
    () => new Date(Date.now() + clockOffsetMs.current).toISOString(),
    []
  );

  useEffect(() => {
    if (state.phase !== "verify" || state.realOk || pollingStopped) return;
    const started = Date.now();
    const t = setInterval(() => {
      const elapsed = Date.now() - started;
      setWaitingMs(elapsed);
      if (elapsed >= 10 * 60 * 1000) setPollingStopped(true);
    }, 1000);
    return () => clearInterval(t);
  }, [state.phase, state.realOk, pollingStopped, pollEpoch]);

  // 연결 확인: 이 단계에 들어온 뒤 도착한 알림만 인정해요(예전 타임스탬프·sim 무시).
  useEffect(() => {
    if (state.phase !== "verify") return;
    const data = status.data;
    if (!data) return;
    const arrival = pickVerifyArrival(state.verifyStartedAt, data);
    if (arrival) {
      dispatch({ type: "EVENT_RECEIVED", kind: arrival.kind, at: arrival.at });
    }
  }, [status.data, state.phase, state.verifyStartedAt]);

  useEffect(() => {
    const n = status.data?.recentEvents.length ?? 0;
    if (n > prevEventCount.current) prevEventCount.current = n;
  }, [status.data?.recentEvents.length]);

  const issueToken = useCallback(
    async (replaceExisting: boolean) => {
      if (!online) {
        dispatch({
          type: "ISSUE_FAIL",
          error: toConnectError(toUserFacingError({ source: "network" })),
        });
        return;
      }
      if (state.platform !== "ios" && state.platform !== "android") {
        return;
      }
      dispatch({ type: "ISSUE_START" });
      const base = defaultTokenLabelForPlatform(state.platform);
      let label = base;
      if (state.issueMode === "add" && !replaceExisting) {
        label = nextTokenLabel(activeLabels, base);
      }
      const res = await apiFetchJson<TokenRes>(
        "/api/agent/tokens",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, replaceExisting }),
        },
        { source: "api" }
      );
      if (!res.ok) {
        dispatch({ type: "ISSUE_FAIL", error: toConnectError(res.error) });
        return;
      }
      const ok = await copy(res.data.token);
      dispatch({
        type: "ISSUE_OK",
        token: res.data.token,
        issuedAt: res.data.createdAt,
      });
      dispatch({ type: "COPY_RESULT", ok });
      void refreshTokenMeta();
      if (replaceExisting) {
        const n = res.data.revokedCount ?? 0;
        setToast(
          n > 0
            ? `새 연결 코드로 바꿨어요. 이전 코드 ${n}개는 중지됐어요.`
            : "새 연결 코드를 만들었어요."
        );
      } else if (state.issueMode === "add") {
        setToast("새 기기용 연결 코드를 만들었어요.");
      }
    },
    [
      activeLabels,
      copy,
      online,
      refreshTokenMeta,
      state.issueMode,
      state.platform,
    ]
  );

  const saveOnboarding = useCallback(
    async (body: Record<string, unknown>) => {
      return apiFetchJson<{ ok: boolean }>(
        "/api/agent/onboarding",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { source: "api" }
      );
    },
    []
  );

  const skip = useCallback(async () => {
    if (!online) {
      dispatch({
        type: "SKIP_FAIL",
        error: toConnectError(toUserFacingError({ source: "network" })),
      });
      return;
    }
    dispatch({ type: "SKIP_START" });
    const res = await saveOnboarding({
      status: "skipped",
      platform: state.platform,
    });
    if (!res.ok) {
      dispatch({ type: "SKIP_FAIL", error: toConnectError(res.error) });
      return;
    }
    dispatch({ type: "SKIP_OK" });
    clearSnapshot();
    router.replace(resolvePostOnboardingPath(window.location.search));
  }, [online, router, saveOnboarding, state.platform]);

  const enterVerify = useCallback(async () => {
    dispatch({ type: "CONFIRM_AUTOMATION", at: nowIso() });
    void saveOnboarding({
      status: "partial",
      platform: state.platform,
      selectedApps: state.selectedApps,
    });
  }, [nowIso, saveOnboarding, state.platform, state.selectedApps]);

  const serverTest = useCallback(async () => {
    if (!online) {
      setServerTestError(toUserFacingError({ source: "network" }));
      return;
    }
    dispatch({ type: "SERVER_TEST_START" });
    setServerTestError(null);
    const res = await apiFetchJson<TestRes>(
      "/api/agent/onboarding/test",
      { method: "POST" },
      { source: "api" }
    );
    if (!res.ok) {
      dispatch({
        type: "SERVER_TEST_FAIL",
        error: toConnectError(res.error),
      });
      setServerTestError(res.error);
      return;
    }
    dispatch({
      type: "SERVER_TEST_OK",
      duplicate: Boolean(res.data.duplicate),
    });
  }, [online]);

  const finish = useCallback(
    async (statusValue: "done" | "partial") => {
      if (!online) {
        dispatch({
          type: "FINISH_FAIL",
          error: toConnectError(toUserFacingError({ source: "network" })),
        });
        return;
      }
      dispatch({ type: "FINISH_START" });
      const res = await saveOnboarding({
        status: statusValue,
        platform: state.platform,
        selectedApps: state.selectedApps,
      });
      if (!res.ok) {
        dispatch({ type: "FINISH_FAIL", error: toConnectError(res.error) });
        return;
      }
      dispatch({ type: "FINISH_OK", status: statusValue });
      clearSnapshot();
      router.replace(resolvePostOnboardingPath(window.location.search));
    },
    [online, router, saveOnboarding, state.platform, state.selectedApps]
  );

  if (!isReady || !booted) {
    return (
      <div className="space-y-3 p-1" aria-busy="true">
        <p className="text-sm text-ink-body">기기를 확인하는 중…</p>
        <div className="h-4 animate-pulse rounded bg-surface-soft" />
        <div className="h-4 animate-pulse rounded bg-surface-soft" />
        <div className="h-4 animate-pulse rounded bg-surface-soft" />
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="rounded-2xl border border-line-muted bg-surface-base p-5">
        <p className="text-sm leading-relaxed text-ink-heading">
          로그인하면 자동 기록을 연결할 수 있어요
        </p>
        <Link
          href="/login?next=/onboarding/automation"
          className="ai-gradient-bg mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl text-base font-bold text-surface-white"
        >
          로그인하기
        </Link>
        <Link
          href="/"
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-sm text-ink-body underline"
        >
          홈으로
        </Link>
      </div>
    );
  }

  const showLater =
    showConnectStepper(state) && state.issueMode === "wizard";

  const sinceEvents = eventsSince(
    status.data?.recentEvents ?? [],
    state.verifyStartedAt
  );
  const realEvent = state.realOk ? newestRealEvent(sinceEvents) : null;
  const realEventTripLabel =
    realEvent?.tripId != null
      ? (trips.find((t) => t.id === realEvent.tripId)?.destination ?? null)
      : null;

  const userError: UserFacingError | null = state.error
    ? {
        code: state.error.code,
        message: state.error.message,
        retryable: state.error.retryable,
        retryAfterSec: state.error.retryAfterSec,
        action: state.error.action as UserFacingError["action"],
        operatorHint: state.error.operatorHint,
      }
    : null;

  const pasteTrip = activeTrips[0] ?? trips[0];
  const pasteHref = pasteTrip
    ? `/trips/${pasteTrip.id}/ledger`
    : "/agent";

  const hubUiState = status.uiState ?? bootStatus.uiState;
  const lastAt =
    status.data?.lastNotificationAt ??
    bootStatus.data?.lastNotificationAt ??
    null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showConnectStepper(state) ? (
            <ConnectStepCards
              state={state}
              onGoTo={(phase) => dispatch({ type: "GO_TO_STEP", phase })}
            />
          ) : null}
        </div>
        {showLater ? (
          <button
            type="button"
            className="min-h-11 shrink-0 px-2 text-sm font-semibold text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            disabled={state.busy === "skip"}
            aria-busy={state.busy === "skip"}
            onClick={() => void skip()}
          >
            나중에 하기
          </button>
        ) : null}
        {state.phase !== "hub" &&
        state.issueMode !== "wizard" &&
        state.phase !== "done" &&
        state.phase !== "skipped" ? (
          <button
            type="button"
            className="min-h-11 shrink-0 px-2 text-sm font-semibold text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onClick={() => {
              clearSnapshot();
              dispatch({ type: "BACK_TO_HUB" });
              void refreshTokenMeta();
            }}
          >
            연결 관리로
          </button>
        ) : null}
      </div>

      {state.phase !== "hub" ? (
        <GateNotice gate={gate} nextPath={nextPath} />
      ) : null}

      {userError ? (
        <ConnectError
          error={userError}
          onRetry={() => {
            dispatch({ type: "DISMISS_ERROR" });
            if (state.phase === "code") {
              void issueToken(state.issueMode === "reissue");
            }
          }}
          onReissue={() => dispatch({ type: "REISSUE_REQUEST" })}
          onLogin={() => router.push("/login?next=/onboarding/automation")}
          onOpenGuide={() =>
            router.push(
              `/onboarding/shortcut-guide?platform=${
                state.platform === "android" ? "android" : "ios"
              }`
            )
          }
        />
      ) : null}

      {state.phase === "hub" ? (
        <ConnectHub
          uiState={hubUiState}
          activeTokenCount={activeTokenCount}
          lastNotificationAt={lastAt}
          pasteHref={pasteHref}
          onVerify={() => dispatch({ type: "RESUME_VERIFY", at: nowIso() })}
          onAddDevice={() => {
            void refreshTokenMeta().then(() =>
              dispatch({ type: "START_ADD_DEVICE" })
            );
          }}
          onReissue={() => dispatch({ type: "START_REISSUE" })}
        />
      ) : null}

      {state.phase === "device" ? (
        <StepDevice
          platform={state.platform}
          onIos27={(v) => dispatch({ type: "SET_IOS27", value: v })}
          onAndroidNext={() =>
            dispatch({ type: "PLATFORM_DETECTED", platform: "android" })
          }
        />
      ) : null}

      {state.phase === "unsupported" ? (
        <UnsupportedHandoff
          reason={state.ios27 === false ? "ios-low" : "desktop"}
          skipBusy={state.busy === "skip"}
          onSkip={() => void skip()}
          onBackToDevice={() => dispatch({ type: "BACK_TO_DEVICE" })}
        />
      ) : null}

      {state.phase === "code" ? (
        <StepCode
          platform={state.platform}
          token={state.token.plain ?? null}
          copied={state.token.copied}
          needsToken={state.needsToken}
          issuing={state.busy === "issue"}
          reissueOpen={state.reissueOpen}
          toast={toast}
          onIssue={() =>
            void issueToken(state.issueMode === "reissue")
          }
          onCopyResult={(ok) => dispatch({ type: "COPY_RESULT", ok })}
          onNext={() => dispatch({ type: "CODE_NEXT" })}
          onReissueRequest={() => dispatch({ type: "REISSUE_REQUEST" })}
          onReissueConfirm={() => void issueToken(true)}
          onReissueCancel={() => {
            if (state.issueMode === "reissue" && !state.token.plain) {
              clearSnapshot();
              dispatch({ type: "BACK_TO_HUB" });
              return;
            }
            dispatch({ type: "REISSUE_CANCEL" });
          }}
        />
      ) : null}

      {state.phase === "shortcut" ? (
        <StepShortcut
          token={state.token.plain ?? null}
          copied={state.token.copied}
          needsToken={state.needsToken}
          onOpenShortcut={() => dispatch({ type: "OPEN_SHORTCUT" })}
          onCopyResult={(ok) => dispatch({ type: "COPY_RESULT", ok })}
          onConfirmAdded={() => dispatch({ type: "CONFIRM_ADDED" })}
          onReissueRequest={() => dispatch({ type: "REISSUE_REQUEST" })}
        />
      ) : null}

      {state.phase === "automation" ? (
        <StepAutomation
          platform={state.platform}
          token={state.token.plain ?? null}
          selectedApps={state.selectedApps}
          onSelectedApps={(apps) =>
            dispatch({ type: "SET_SELECTED_APPS", apps })
          }
          onConfirm={() => void enterVerify()}
        />
      ) : null}

      {state.phase === "verify" ? (
        <StepVerify
          state={state}
          platform={state.platform}
          events={status.data?.recentEvents ?? []}
          eventsLoading={status.loading}
          rateSlow={status.rateSlow}
          serverTestError={serverTestError}
          waitingMs={waitingMs}
          pollingStopped={pollingStopped}
          realEvent={realEvent}
          realEventTripLabel={realEventTripLabel}
          finishing={state.busy === "finish"}
          testing={state.busy === "server-test"}
          onServerTest={() => void serverTest()}
          onRetryServerTest={() => void serverTest()}
          onResumePolling={() => {
            setPollingStopped(false);
            setWaitingMs(0);
            setPollEpoch((e) => e + 1);
          }}
          onFinishDone={() => void finish("done")}
          onFinishPartial={() => void finish("partial")}
        />
      ) : null}

      {showStrip && state.phase !== "verify" ? (
        <RecentEventsStrip
          events={status.data?.recentEvents ?? []}
          announceArrival
          prevCount={prevEventCount.current}
        />
      ) : null}

      {state.phase === "done" || state.phase === "skipped" ? (
        <p role="status" className="text-sm text-ink-body">
          이동하는 중…
        </p>
      ) : null}
    </div>
  );
}
