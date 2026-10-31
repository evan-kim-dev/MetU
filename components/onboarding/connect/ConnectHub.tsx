"use client";

import Link from "next/link";

import { formatRelativeTime } from "@/lib/format/relative-time";
import type { AutomationUiState } from "@/lib/onboarding/automation-ui-state";

type Props = {
  uiState: AutomationUiState | null;
  activeTokenCount: number;
  lastNotificationAt: string | null;
  pasteHref: string;
  onVerify: () => void;
  onAddDevice: () => void;
  onReissue: () => void;
};

export function ConnectHub({
  uiState,
  activeTokenCount,
  lastNotificationAt,
  pasteHref,
  onVerify,
  onAddDevice,
  onReissue,
}: Props) {
  const unverified = uiState === "unverified";
  const title = unverified
    ? "연결을 확인해야 해요"
    : "자동 기록이 연결되어 있어요";

  const lastLine = lastNotificationAt
    ? `마지막 수신 ${formatRelativeTime(lastNotificationAt)}`
    : "아직 받은 알림이 없어요";

  const countLine =
    activeTokenCount > 0
      ? `활성 연결 코드 ${activeTokenCount}개 · ${lastLine}`
      : lastLine;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <section className="rounded-2xl bg-surface-white p-4 shadow-sm ring-1 ring-line-soft">
        <h2
          tabIndex={-1}
          className="text-lg font-extrabold text-ink-heading focus:outline-none"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-body">{countLine}</p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onVerify}
            className="ai-gradient-bg inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl text-base font-bold text-surface-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            연결 상태 확인하기
          </button>
          <button
            type="button"
            onClick={onAddDevice}
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-line-muted bg-surface-base text-base font-bold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            다른 기기 추가하기
          </button>
          <button
            type="button"
            onClick={onReissue}
            className="inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            이 기기 연결 코드 다시 만들기
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label="다른 연결 방법">
        <Link
          href="/onboarding/shortcut-guide"
          className="rounded-2xl bg-surface-soft px-4 py-3 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          연동 가이드 보기
        </Link>
        <Link
          href="/agent"
          className="rounded-2xl bg-surface-soft px-4 py-3 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          가계부에서 따로 연결
        </Link>
        <Link
          href={pasteHref}
          className="rounded-2xl bg-surface-soft px-4 py-3 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          직접 붙여넣기로 기록
        </Link>
        {pasteHref === "/agent" ? (
          <p className="px-1 text-xs text-ink-body">
            여행을 고른 뒤 가계부에서 문자·영수증을 붙여넣을 수 있어요.
          </p>
        ) : null}
      </section>

      <Link
        href="/"
        className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        홈으로
      </Link>
    </div>
  );
}
