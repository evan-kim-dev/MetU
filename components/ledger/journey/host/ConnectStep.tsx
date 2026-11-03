"use client";

import Link from "next/link";
import { BellRing, CircleAlert, CircleCheck, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ds/Skeleton";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";

type Props = {
  tripId: string;
  /** "나중에 직접 입력할게요" — 초대 단계로 넘어가요. */
  onLater: () => void;
};

const CARD = "rounded-mu-lg border border-mu-line bg-mu-card p-4";
const LATER =
  "mu-focus mt-1 inline-flex min-h-tap items-center text-mu-label text-mu-fg-2 underline underline-offset-2";

/**
 * 호스트 ① 연결 단계. 주 CTA(연결하기/다음)는 TripJourney 의 BottomCTA 가 맡아요.
 * "연결됨" 판정은 BottomCTA 와 같은 기준(hasActiveToken)이에요.
 */
export function ConnectStep({ tripId, onLater }: Props) {
  const { data, error, loading, refresh, uiState } = useAutomationStatus({
    lite: true,
  });
  const manageHref = `/trips/${tripId}/ledger/connect`;

  if (!data && (loading || (!error && !uiState))) {
    return (
      <section aria-busy="true" aria-label="자동 수집 상태 불러오는 중" className={CARD}>
        <Skeleton h={20} w="60%" />
        <Skeleton h={16} w="85%" className="mt-2" />
        <Skeleton h={44} w={160} className="mt-4" />
      </section>
    );
  }

  if (!data && error) {
    return (
      <section aria-labelledby="connect-error-title" className={CARD}>
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-mu-err" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0">
            <h2 id="connect-error-title" className="text-mu-heading text-mu-fg">
              연결 상태를 불러오지 못했어요
            </h2>
            <p className="mt-1 text-mu-body text-mu-fg-2">
              잠시 후 다시 시도해 주세요. 연결은 그대로 유지돼요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mu-focus mt-3 inline-flex min-h-tap items-center gap-2 rounded-mu-md border border-mu-line-strong bg-mu-card px-4 text-mu-label text-mu-fg"
        >
          <RefreshCw className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          다시 시도
        </button>
        <div>
          <button type="button" className={LATER} onClick={onLater}>
            나중에 직접 입력할게요
          </button>
        </div>
      </section>
    );
  }

  const connected = Boolean(data?.hasActiveToken);

  if (connected) {
    const last = data?.lastNotificationAt
      ? formatRelativeTime(data.lastNotificationAt)
      : "";
    const line =
      uiState === "silent"
        ? "최근 24시간 동안 받은 알림이 없어요. 자동화가 켜져 있는지 확인해 보세요."
        : uiState === "ok"
          ? last
            ? `마지막 수신 ${last}`
            : "알림이 오면 여기에 바로 쌓여요."
          : "연결됐어요. 카드 결제 알림이 오면 여기에 바로 쌓여요.";
    return (
      <section aria-labelledby="connect-ok-title" className={CARD}>
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-mu-ok" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="connect-ok-title" className="text-mu-heading text-mu-fg">
              자동 수집이 켜져 있어요
            </h2>
            <p className="mt-1 text-mu-body text-mu-fg-2">{line}</p>
          </div>
          <Link
            href={manageHref}
            className="mu-focus inline-flex min-h-tap shrink-0 items-center px-2 text-mu-label text-mu-accent"
          >
            관리
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="connect-off-title" className={CARD}>
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-mu-accent" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0">
          <h2 id="connect-off-title" className="text-mu-heading text-mu-fg">
            카드 알림을 연결하면 입력 없이 기록돼요
          </h2>
          <p className="mt-1 text-mu-body text-mu-fg-2">
            결제 알림이 오면 가게와 금액이 자동으로 쌓여요. 아래
            「자동 수집 연결하기」로 한 번만 설정하면 돼요.
          </p>
        </div>
      </div>
      <button type="button" className={LATER} onClick={onLater}>
        나중에 직접 입력할게요
      </button>
    </section>
  );
}
