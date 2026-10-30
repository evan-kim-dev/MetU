"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { gateLabel } from "@/lib/onboarding/gate-label";

type Props = {
  gate: string | null;
  nextPath: string | null;
};

export function GateNotice({ gate, nextPath }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (gate !== "1" || dismissed) return null;

  const label = nextPath ? gateLabel(nextPath) : null;

  return (
    <div
      role="status"
      className="relative rounded-2xl border border-line-muted bg-surface-soft p-4"
    >
      <button
        type="button"
        aria-label="닫기"
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <h3 className="pr-10 text-sm font-extrabold text-ink-heading">
        먼저 자동 기록 설정부터 해 주세요
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-body">
        MetU는 카드 알림을 자동으로 가계부에 적어 줘요. 설정은 몇 분이면
        끝나고, 지금 어렵다면 &apos;나중에 하기&apos;를 눌러도 돼요.
      </p>
      {label ? (
        <p className="mt-2 text-sm text-ink-body">
          설정을 마치면 {label}으로 돌아가요.
        </p>
      ) : null}
    </div>
  );
}
