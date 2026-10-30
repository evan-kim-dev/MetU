"use client";

import Link from "next/link";

import { agentEventStatusLabelForUi } from "@/lib/agent/event-status";
import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";

type Props = {
  event: AutomationStatusEvent;
  unassigned: boolean;
};

export function FirstEventBanner({ event, unassigned }: Props) {
  const preview =
    event.textPreview.length > 40
      ? `${event.textPreview.slice(0, 40)}…`
      : event.textPreview;

  return (
    <div
      role="status"
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 motion-reduce:transition-none"
    >
      <p className="text-sm font-extrabold text-ink-heading">
        알림이 도착했어요 🎉
      </p>
      <p className="mt-1 text-sm text-ink-body">
        {preview || "(내용 없음)"} ·{" "}
        {agentEventStatusLabelForUi({
          status: event.status,
          isTest: event.isTest,
        })}
      </p>
      {unassigned ? (
        <div className="mt-3 rounded-xl bg-surface-base/80 p-3">
          <p className="text-sm text-ink-body">
            아직 진행 중인 여행이 없어서 수신함에 보관했어요. 여행을 만들면
            가계부에 넣을 수 있어요.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              여행 만들기
            </Link>
            <Link
              href="/agent/inbox"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              수신함 보기
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
