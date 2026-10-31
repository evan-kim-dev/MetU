"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { gateLabel } from "@/lib/onboarding/gate-label";

type Props = {
  gate: string | null;
  nextPath: string | null;
};

/** 받침 없음/ㄹ 받침이면 "로", 아니면 "으로". */
function toDirection(word: string): "로" | "으로" {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "으로";
  const final = code % 28;
  return final === 0 || final === 8 ? "로" : "으로";
}

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
        자동 기록을 연결해 보세요
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-body">
        자동 기록을 연결하면 카드 알림이 가계부에 자동으로 적혀요. 나중에 해도
        돼요.
      </p>
      {label ? (
        <p className="mt-2 text-sm text-ink-body">
          설정을 마치면 {label}{toDirection(label)} 돌아가요.
        </p>
      ) : null}
    </div>
  );
}
