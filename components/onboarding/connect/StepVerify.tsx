"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ConnectError } from "@/components/onboarding/connect/ConnectError";
import { FirstEventBanner } from "@/components/onboarding/connect/FirstEventBanner";
import { RecentEvents } from "@/components/onboarding/connect/RecentEvents";
import { StickyActionBar } from "@/components/onboarding/connect/StickyActionBar";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { agentEventStatusLabelForUi } from "@/lib/agent/event-status";
import type { UserFacingError } from "@/lib/errors/user-message";
import { formatRelativeTime } from "@/lib/format/relative-time";
import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";
import type { DetectedPlatform } from "@/lib/onboarding/automation";
import {
  canFinish,
  canFinishAnyway,
  type ConnectState,
} from "@/lib/onboarding/connect-machine";
import { lastDeviceEvent } from "@/lib/onboarding/last-device-event";

type Props = {
  state: ConnectState;
  platform: DetectedPlatform;
  events: AutomationStatusEvent[];
  eventsLoading: boolean;
  unassignedCount: number;
  rateSlow: boolean;
  serverTestError: UserFacingError | null;
  waitingMs: number;
  pollingStopped: boolean;
  firstEvent: AutomationStatusEvent | null;
  finishing: boolean;
  testing: boolean;
  onServerTest: () => void;
  onRetryServerTest: () => void;
  onResumePolling: () => void;
  onFinishDone: () => void;
  onFinishPartial: () => void;
};

export function StepVerify({
  state,
  platform,
  events,
  eventsLoading,
  unassignedCount,
  rateSlow,
  serverTestError,
  waitingMs,
  pollingStopped,
  firstEvent,
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

  const lastDevice = lastDeviceEvent(events);
  const finishOk = canFinish(state);
  const finishAnyway = canFinishAnyway(state);

  return (
    <div className="flex flex-col gap-4 pb-28">
      <h2 tabIndex={-1} className="text-xl font-extrabold text-ink-heading">
        연결 확인
      </h2>

      {firstEvent ? (
        <FirstEventBanner
          event={firstEvent}
          unassigned={unassignedCount > 0 || firstEvent.status === "unassigned"}
        />
      ) : null}

      <section className="rounded-2xl border border-line-muted bg-surface-base p-4">
        <h3 className="text-sm font-extrabold text-ink-heading">
          ① MetU 서버 확인
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-body">
          내 계정으로 테스트 알림을 한 번 보내요. 연결 코드와 폰 설정은
          확인하지 않아요.
        </p>
        <PrimaryButton
          type="button"
          className="mt-3"
          loading={testing}
          disabled={testing || state.serverOk}
          onClick={onServerTest}
        >
          {testing
            ? "보내는 중…"
            : state.serverOk
              ? "MetU 서버가 테스트 알림을 받았어요 ✓"
              : "서버 테스트 보내기"}
        </PrimaryButton>
        {state.serverOk ? (
          <p role="status" className="mt-2 text-sm text-ink-body">
            MetU 서버가 테스트 알림을 받았어요 ✓
          </p>
        ) : null}
        {serverTestError ? (
          <div className="mt-3">
            <ConnectError
              error={serverTestError}
              onRetry={onRetryServerTest}
            />
            {serverTestError.code === "rate-limited" ||
            serverTestError.retryAfterSec ? (
              <p className="mt-1 text-xs text-ink-body">
                분당 5회까지 보낼 수 있어요.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line-muted bg-surface-base p-4">
        <h3 className="text-sm font-extrabold text-ink-heading">
          ② 내 폰 확인 (꼭 해 주세요)
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
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-body">
          <li>선택한 카드 앱에서 &apos;승인&apos;이 들어간 알림 받기</li>
          <li>
            카카오톡이나 다른 계정의 Gmail로 &apos;승인 테스트 1,000원&apos;
            보내기(내가 나에게 보낸 Gmail은 알림이 안 울릴 수 있어요)
          </li>
        </ol>

        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          연결만 먼저 확인하고 싶다면 단축어(또는 매크로)로 본문이
          &apos;MTU-TEST 연결 확인&apos;인 글을 한 번 보내 보세요. &apos;연결
          테스트&apos;로 표시되고 가계부에는 들어가지 않아요.
        </p>

        <p
          data-testid="last-device-event"
          className="mt-3 rounded-xl bg-surface-soft p-3 text-sm text-ink-body"
        >
          {lastDevice
            ? `마지막으로 폰에서 받은 알림: ${formatRelativeTime(lastDevice.createdAt)} · ${agentEventStatusLabelForUi({ status: lastDevice.status, isTest: lastDevice.isTest })}`
            : "아직 폰에서 받은 알림이 없어요"}
        </p>

        {!state.deviceOk && !pollingStopped ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ink-body">
            <span
              aria-hidden
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none"
            />
            알림을 기다리는 중이에요. 자동으로 확인해요.
          </p>
        ) : null}

        {hint60 && !state.deviceOk && !pollingStopped ? (
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

        {pollingStopped && !state.deviceOk ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-ink-body">자동 확인을 멈췄어요</p>
            <PrimaryButton type="button" variant="secondary" onClick={onResumePolling}>
              다시 확인하기
            </PrimaryButton>
          </div>
        ) : null}

        {rateSlow ? (
          <p className="mt-2 text-xs text-ink-muted">
            확인이 잠시 느려졌어요
          </p>
        ) : null}
      </section>

      <RecentEvents events={events} loading={eventsLoading} max={5} />

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
