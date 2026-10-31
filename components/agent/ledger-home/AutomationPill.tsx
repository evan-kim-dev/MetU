"use client";

import Link from "next/link";

/** 헤더 카드의 자동 기록 상태 알약. ok/silent 는 같은 초록으로 보여요. */
export type AutomationPillState = "ok" | "silent" | "unverified" | "off";

const LOOK: Record<
  AutomationPillState,
  { label: string; tone: string; dot: string }
> = {
  ok: {
    label: "자동 기록 켜짐",
    tone: "bg-mint/30 text-success",
    dot: "bg-success",
  },
  silent: {
    label: "자동 기록 켜짐",
    tone: "bg-mint/30 text-success",
    dot: "bg-success",
  },
  unverified: {
    label: "연결 확인 필요",
    tone: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
    dot: "bg-amber-500",
  },
  off: {
    label: "자동 기록 꺼짐 · 연결하기",
    tone: "bg-surface-soft text-ink-body",
    dot: "bg-ink-caption",
  },
};

export function AutomationPill({ state }: { state: AutomationPillState }) {
  const look = LOOK[state];
  return (
    <Link
      href="/onboarding/automation"
      data-testid="automation-pill"
      data-state={state}
      className="inline-flex min-h-tap items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span
        className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-bold ${look.tone}`}
      >
        <span aria-hidden className={`h-2 w-2 rounded-full ${look.dot}`} />
        {look.label}
      </span>
    </Link>
  );
}
