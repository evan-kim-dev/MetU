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
import { ConnectStepper } from "@/components/onboarding/connect/ConnectStepper";
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
import {
  connectReducer,
  initialConnectState,
  stepIndex,
  stepLabel,
  stepTotal,
  toSnapshot,
  type ConnectErrorState,
} from "@/lib/onboarding/connect-machine";
import {
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
} from "@/lib/onboarding/connect-storage";

type TokenRes = {
  token: string;
  id: string;
  createdAt?: string;
  revokedCount?: number;
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
  const [state, dispatch] = useReducer(connectReducer, undefined, () =>
    initialConnectState()
  );
  const [detected, setDetected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [serverTestError, setServerTestError] =
    useState<UserFacingError | null>(null);
  const [waitingMs, setWaitingMs] = useState(0);
  const [pollingStopped, setPollingStopped] = useState(false);
  const [pollEpoch, setPollEpoch] = useState(0);
  const prevPhase = useRef(state.phase);
  const prevEventCount = useRef(0);
  const { copy } = useClipboardCopy();

  const gate = searchParams.get("gate");
  const nextPath = searchParams.get("next");

  const showStrip =
    state.phase === "code" ||
    state.phase === "shortcut" ||
    state.phase === "automation" ||
    state.phase === "verify";

  const status = useAutomationStatus({
    enabled: showStrip && !pollingStopped,
    lite: state.phase !== "verify",
    intervalMs: state.phase === "verify" ? 5000 : 10_000,
    cacheTtlMs: 0,
  });

  useEffect(() => {
    const snap = loadSnapshot();
    if (snap) {
      dispatch({ type: "RESTORE", snapshot: snap });
      setDetected(true);
      return;
    }
    const platform = detectPlatform(navigator.userAgent);
    dispatch({ type: "PLATFORM_DETECTED", platform });
    setDetected(true);
  }, []);

  useEffect(() => {
    if (!detected) return;
    if (state.phase === "done" || state.phase === "skipped") {
      clearSnapshot();
      return;
    }
    if (state.phase === "device") return;
    saveSnapshot(toSnapshot(state));
  }, [state, detected]);

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

  useEffect(() => {
    if (state.phase !== "verify" || state.deviceOk || pollingStopped) return;
    const started = Date.now();
    const t = setInterval(() => {
      const elapsed = Date.now() - started;
      setWaitingMs(elapsed);
      if (elapsed >= 10 * 60 * 1000) setPollingStopped(true);
    }, 1000);
    return () => clearInterval(t);
  }, [state.phase, state.deviceOk, pollingStopped, pollEpoch]);

  useEffect(() => {
    if (state.phase !== "verify" || state.deviceOk) return;
    const data = status.data;
    if (!data) return;
    if (data.lastNotificationAt || data.lastDeviceTestAt) {
      dispatch({
        type: "EVENT_RECEIVED",
        kind: data.lastDeviceTestAt ? "device-test" : "real",
        at:
          data.lastNotificationAt ??
          data.lastDeviceTestAt ??
          new Date().toISOString(),
      });
    }
  }, [status.data, state.phase, state.deviceOk]);

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
      dispatch({ type: "ISSUE_START" });
      const label =
        state.platform === "android" ? "Android 매크로" : "iPhone 단축어";
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
      if (replaceExisting) {
        const n = res.data.revokedCount ?? 0;
        setToast(
          n > 0
            ? `새 연결 코드로 바꿨어요. 이전 코드 ${n}개는 중지됐어요.`
            : "새 연결 코드를 만들었어요."
        );
      }
    },
    [copy, online, state.platform]
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
    dispatch({ type: "CONFIRM_AUTOMATION" });
    void saveOnboarding({
      status: "partial",
      platform: state.platform,
      selectedApps: state.selectedApps,
    });
  }, [saveOnboarding, state.platform, state.selectedApps]);

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

  if (!isReady || !detected) {
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
    state.phase !== "unsupported" &&
    state.phase !== "done" &&
    state.phase !== "skipped";

  const firstEvent =
    state.deviceOk && status.data?.recentEvents[0]
      ? status.data.recentEvents[0]
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {state.phase !== "unsupported" &&
          state.phase !== "done" &&
          state.phase !== "skipped" ? (
            <ConnectStepper
              index={stepIndex(state)}
              total={stepTotal(state)}
              label={stepLabel(state)}
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
      </div>

      <GateNotice gate={gate} nextPath={nextPath} />

      {userError ? (
        <ConnectError
          error={userError}
          onRetry={() => {
            dispatch({ type: "DISMISS_ERROR" });
            if (state.phase === "code") void issueToken(false);
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
          onIssue={() => void issueToken(false)}
          onCopyResult={(ok) => dispatch({ type: "COPY_RESULT", ok })}
          onNext={() => dispatch({ type: "CODE_NEXT" })}
          onReissueRequest={() => dispatch({ type: "REISSUE_REQUEST" })}
          onReissueConfirm={() => void issueToken(true)}
          onReissueCancel={() => dispatch({ type: "REISSUE_CANCEL" })}
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
          unassignedCount={status.data?.unassignedCount ?? 0}
          rateSlow={status.rateSlow}
          serverTestError={serverTestError}
          waitingMs={waitingMs}
          pollingStopped={pollingStopped}
          firstEvent={firstEvent}
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
