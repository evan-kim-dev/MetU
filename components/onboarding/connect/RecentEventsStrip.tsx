"use client";

import { agentEventStatusLabelForUi } from "@/lib/agent/event-status";
import { formatRelativeTime } from "@/lib/format/relative-time";
import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";

type Props = {
  events: AutomationStatusEvent[];
  announceArrival?: boolean;
  prevCount?: number;
};

export function RecentEventsStrip({
  events,
  announceArrival = true,
  prevCount = 0,
}: Props) {
  const rows = events.slice(0, 3);
  const arrived = announceArrival && events.length > prevCount && prevCount >= 0;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-ink-heading">최근 받은 알림</h3>
      {arrived ? (
        <p role="status" className="text-sm font-semibold text-ink-heading">
          알림이 도착했어요 🎉
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-ink-body">아직 받은 알림이 없어요</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate text-ink-body">
                {formatRelativeTime(e.createdAt)} · {e.textPreview || "(내용 없음)"}
              </span>
              <span className="shrink-0 text-xs text-ink-muted">
                {agentEventStatusLabelForUi({
                  status: e.status,
                  isTest: e.isTest,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
