"use client";

import { agentEventStatusLabelForUi } from "@/lib/agent/event-status";
import { formatRelativeTime } from "@/lib/format/relative-time";
import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";

type Props = {
  events: AutomationStatusEvent[];
  loading?: boolean;
  max?: number;
};

export function RecentEvents({ events, loading, max = 5 }: Props) {
  const rows = events.slice(0, max);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-ink-heading">최근 받은 알림</h3>
      {loading && rows.length === 0 ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-10 animate-pulse rounded-xl bg-surface-soft" />
          <div className="h-10 animate-pulse rounded-xl bg-surface-soft" />
        </div>
      ) : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-ink-body">아직 받은 알림이 없어요</p>
      ) : null}
      <ul className="space-y-2">
        {rows.map((e) => (
          <li
            key={e.id}
            className="rounded-xl border border-line-muted bg-surface-base p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-muted">
                  {formatRelativeTime(e.createdAt)}
                </p>
                <p className="truncate text-ink-heading">
                  {e.textPreview || "(내용 없음)"}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-ink-heading">
                {agentEventStatusLabelForUi({
                  status: e.status,
                  isTest: e.isTest,
                })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
