"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ConnectError } from "@/components/onboarding/connect/ConnectError";
import { RecentEvents } from "@/components/onboarding/connect/RecentEvents";
import { StickyActionBar } from "@/components/onboarding/connect/StickyActionBar";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  agentEventReasonLine,
  agentEventStatusLabelForUi,
} from "@/lib/agent/event-status";
import type { UserFacingError } from "@/lib/errors/user-message";
import { formatRelativeTime } from "@/lib/format/relative-time";
import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";
import type { DetectedPlatform } from "@/lib/onboarding/automation";
import {
  canFinish,
  canFinishAnyway,
  type ConnectState,
} from "@/lib/onboarding/connect-machine";
import {
  eventsSince,
  lastDeviceEvent,
} from "@/lib/onboarding/last-device-event";

type Props = {
  state: ConnectState;
  platform: DetectedPlatform;
  events: AutomationStatusEvent[];
  eventsLoading: boolean;
  rateSlow: boolean;
  serverTestError: UserFacingError | null;
  waitingMs: number;
  pollingStopped: boolean;
  /** 확인 단계 진입 뒤 도착한 실제 카드 알림 (sim·MTU-TEST 제외) */
  realEvent: AutomationStatusEvent | null;
  /** realEvent 가 붙은 여행 이름 (모르면 null) */
  realEventTripLabel: string | null;
  finishing: boolean;
  testing: boolean;
  onServerTest: () => void;
  onRetryServerTest: () => void;
  onResumePolling: () => void;
  onFinishDone: () => void;
  onFinishPartial: () => void;
};

type StageStatus = "done" | "current" | "pending";

function StageRow({
  status,
  title,
  desc,
  testId,
}: {
  status: StageStatus;
  title: string;
  desc: string;
  testId: string;
}) {
  const chip =
    status === "done" ? "완료" : status === "current" ? "기다리는 중" : "대기";
  return (
    <li
      data-testid={testId}
      data-status={status}
      aria-current={status === "current" ? "step" : undefined}
      className={[
        "flex min-h-14 items-start gap-3 rounded-xl px-3 py-2.5",
        status === "done"
          ? "bg-emerald-50"
          : status === "current"
            ? "bg-surface-soft ring-1 ring-brand/40"
            : "bg-surface-soft/60",
      ].join(" ")}
    >
      <span aria-hidden className="mt-0.5 text-base">
        {status === "done" ? (
          "✅"
        ) : status === "current" ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none" />
        ) : (
          "⚪"
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-ink-heading">{title}</span>
          <span className="rounded-full bg-surface-base px-2 py-0.5 text-xs font-semibold text-ink-body">
            {chip}
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-body">
          {desc}
        </span>
      </span>
    </li>
  );
}

export function StepVerify({
  state,
  platform,
  events,
  eventsLoading,
  rateSlow,
  serverTestError,
  waitingMs,
  pollingStopped,
  realEvent,
  realEventTripLabel,
  finishing,
  testing,
  onServerTest,
  onRetryServerTest,
  onResumePolling,
  onFinishDone,
  onFinishPartial,
}: Props) {
  const [hint60, setHint60] = useState(false);

  useEffect(() => {
    setHint60(waitingMs >= 60_000);
  }, [waitingMs]);

  const faq =
    platform === "android"
      ? "/onboarding/shortcut-guide?platform=android&faq=and-faq-1"
      : "/onboarding/shortcut-guide?platform=ios&faq=ios-faq-1";

  // 이 단계에 들어온 뒤 도착한 이벤트만 보여 줘요(예전 기록으로 안심시키지 않아요).
  const sinceEvents = eventsSince(events, state.verifyStartedAt);
  const lastDevice = lastDeviceEvent(sinceEvents);
  const finishOk = canFinish(state);
  const finishAnyway = canFinishAnyway(state);

  const waiting = !state.deviceOk;
  const testStage: StageStatus = state.deviceOk ? "done" : "pending";
  const realStage: StageStatus = state.realOk
    ? "done"
    : state.deviceOk
      ? "current"
      : "pending";
  const attached =
    realEvent != null &&
    (realEvent.tripId != null || realEventTripLabel != null) &&
    realEvent.status !== "unassigned";

  return (
    <div className="flex flex-col gap-4 pb-28">
      <h2 tabIndex={-1} className="text-xl font-extrabold text-ink-heading">
        연결 확인
      </h2>

      <section className="rounded-2xl border border-line-muted bg-surface-base p-4">
        <h3 className="text-sm font-extrabold text-ink-heading">
          내 폰에서 알림 보내 보기 (꼭 해 주세요)
        </h3>
        {platform === "ios" ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-body">
            단축어 앱에서 ▶로 직접 실행하면 &apos;보낼 알림 내용이 비어
            있어요(text_or_body_required)&apos; 오류가 나는 게 정상이에요. 실제
            알림으로 확인해 주세요.
          </p>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-ink-body">
            MacroDroid 매크로가 실제 알림을 보내면 여기서 확인돼요.
          </p>
        )}

        <ol
          aria-label="연결 확인 진행 상태"
          className="mt-3 flex flex-col gap-2"
        >
          <StageRow
            testId="stage-wait"
            status={waiting ? "current" : "done"}
            title={waiting ? "알림을 기다리는 중이에요" : "알림이 도착했어요"}
            desc={
              waiting
                ? "이 화면에 들어온 뒤에 도착한 알림만 확인해요. 예전에 연결했더라도 새로 보내 주세요."
                : "자동으로 확인했어요."
            }
          />
          <StageRow
            testId="stage-test"
            status={testStage}
            title="연결 테스트 알림 도착 (MTU-TEST)"
            desc={
              state.deviceOk
                ? "폰이 MetU로 알림을 보내고 있어요. 연결은 OK예요."
                : "단축어(또는 매크로)로 본문이 \u2018MTU-TEST 연결 확인\u2019인 글을 한 번 보내 보세요. 가계부에는 들어가지 않아요."
            }
          />
          <StageRow
            testId="stage-real"
            status={realStage}
            title="실제 카드 알림 도착"
            desc={
              state.realOk
                ? "카드 알림이 자동 기록으로 들어왔어요."
                : "카드 앱의 \u2018승인\u2019 알림을 받으면 확인돼요. 카카오톡이나 다른 계정의 Gmail로 \u2018승인 테스트 1,000원\u2019을 보내도 돼요(내가 나에게 보낸 Gmail은 알림이 안 울릴 수 있어요)."
            }
          />
        </ol>

        {state.realOk && realEvent ? (
          <div
            role="status"
            data-testid="real-event-result"
            className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"
          >
            <p className="text-sm font-extrabold text-ink-heading">
              {attached
                ? realEventTripLabel
                  ? `여행 ${realEventTripLabel}에 붙었어요`
                  : "여행에 붙었어요"
                : "아직 여행에 안 붙었어요"}
            </p>
            <p className="mt-1 text-sm text-ink-body">
              {realEvent.textPreview || "(내용 없음)"} ·{" "}
              {agentEventStatusLabelForUi({
                status: realEvent.status,
                isTest: realEvent.isTest,
              })}
            </p>
            {realEvent.status === "unassigned" ||
            realEvent.status === "failed" ? (
              <p
                data-testid="real-event-reason"
                className="mt-1 text-sm text-ink-body"
              >
                {agentEventReasonLine({
                  status: realEvent.status,
                  reason: realEvent.reason,
                  error: realEvent.error,
                  isTest: realEvent.isTest,
                })}
              </p>
            ) : null}
            {!attached ? (
              <Link
                href="/agent/inbox"
                className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                수신함에서 붙이기
              </Link>
            ) : null}
          </div>
        ) : null}

        <p
          data-testid="last-device-event"
          className="mt-3 rounded-xl bg-surface-soft p-3 text-sm text-ink-body"
        >
          {lastDevice
            ? `마지막으로 폰에서 받은 알림: ${formatRelativeTime(lastDevice.createdAt)} · ${agentEventStatusLabelForUi({ status: lastDevice.status, isTest: lastDevice.isTest })}`
            : "아직 폰에서 받은 알림이 없어요"}
        </p>

        {hint60 && waiting && !pollingStopped ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-ink-body">
              아직 도착하지 않았어요. 자동화 설정을 다시 확인해 볼까요?
            </p>
            <Link
              href={faq}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              문제 해결 보기
            </Link>
          </div>
        ) : null}

        {pollingStopped && !state.realOk ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-ink-body">자동 확인을 멈췄어요</p>
            <PrimaryButton
              type="button"
              variant="secondary"
              onClick={onResumePolling}
            >
              다시 확인하기
            </PrimaryButton>
          </div>
        ) : null}

        {rateSlow ? (
          <p className="mt-2 text-xs text-ink-muted">확인이 잠시 느려졌어요</p>
        ) : null}
      </section>

      <RecentEvents events={sinceEvents} loading={eventsLoading} max={5} />

      <section
        aria-label="서버 확인"
        className="rounded-2xl border border-dashed border-line-muted p-4"
      >
        <p className="text-sm leading-relaxed text-ink-body">
          폰 설정과 상관없이 MetU 서버가 알림을 받을 수 있는지만 확인해요.
          폰이 연결됐다는 뜻은 아니에요.
        </p>
        <PrimaryButton
          type="button"
          variant="secondary"
          className="mt-3"
          loading={testing}
          disabled={testing || state.serverOk}
          onClick={onServerTest}
        >
          {testing
            ? "보내는 중…"
            : state.serverOk
              ? "서버는 정상이에요 ✓"
              : "서버만 확인(폰 연결은 아니에요)"}
        </PrimaryButton>
        {state.serverOk ? (
          <p role="status" className="mt-2 text-sm text-ink-body">
            MetU 서버는 정상이에요. 폰 연결은 위 단계에서 따로 확인돼요.
          </p>
        ) : null}
        {serverTestError ? (
          <div className="mt-3">
            <ConnectError error={serverTestError} onRetry={onRetryServerTest} />
            {serverTestError.code === "rate-limited" ||
            serverTestError.retryAfterSec ? (
              <p className="mt-1 text-xs text-ink-body">
                분당 5회까지 보낼 수 있어요.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <StickyActionBar>
        {finishOk ? (
          <PrimaryButton
            type="button"
            loading={finishing}
            disabled={finishing}
            onClick={onFinishDone}
          >
            {finishing ? "저장하는 중…" : "완료하고 홈으로"}
          </PrimaryButton>
        ) : null}
        {!finishOk && finishAnyway ? (
          <>
            <p className="text-sm text-ink-body">
              폰에서 알림이 오는지 아직 확인하지 못했어요. 홈에서 계속 알려
              드릴게요.
            </p>
            <PrimaryButton
              type="button"
              variant="secondary"
              loading={finishing}
              disabled={finishing}
              onClick={onFinishPartial}
            >
              {finishing ? "저장하는 중…" : "일단 완료하고 나중에 확인할게요"}
            </PrimaryButton>
          </>
        ) : null}
      </StickyActionBar>
    </div>
  );
}
