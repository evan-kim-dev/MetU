"use client";

import {
  connectStepCards,
  type ConnectState,
  type ConnectStepPhase,
  type ConnectStepStatus,
} from "@/lib/onboarding/connect-machine";

type Props = {
  state: ConnectState;
  onGoTo: (phase: ConnectStepPhase) => void;
};

const CHIP: Record<ConnectStepStatus, string> = {
  done: "완료",
  current: "진행 중",
  upcoming: "대기",
};

const CHIP_STYLE: Record<ConnectStepStatus, string> = {
  done: "bg-emerald-100 text-emerald-800",
  current: "bg-brand text-surface-white",
  upcoming: "bg-surface-base text-ink-body",
};

/**
 * 연결 단계를 세로 카드 목록으로 보여 줘요.
 * (기기 확인 · 연결 코드 · 단축어/매크로 · 자동화 만들기 · 연결 확인)
 * 완료한 카드를 누르면 그 단계로 돌아가요. 카드 높이 56px 이상.
 */
export function ConnectStepCards({ state, onGoTo }: Props) {
  const cards = connectStepCards(state);
  const doneCount = cards.filter((c) => c.status === "done").length;
  const busy = state.busy !== null;

  return (
    <nav aria-label="연결 단계" className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-ink-heading" aria-live="polite">
        {Math.min(doneCount + 1, cards.length)}/{cards.length} 단계
      </p>
      <ol className="flex flex-col gap-1.5">
        {cards.map((card, i) => {
          const body = (
            <>
              <span
                aria-hidden
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                  card.status === "current"
                    ? "bg-brand text-surface-white"
                    : card.status === "done"
                      ? "bg-emerald-500 text-surface-white"
                      : "bg-line-muted text-ink-body",
                ].join(" ")}
              >
                {card.status === "done" ? "✓" : i + 1}
              </span>
              <span
                className={[
                  "min-w-0 flex-1 text-left text-sm",
                  card.status === "current"
                    ? "font-extrabold text-ink-heading"
                    : "font-semibold text-ink-body",
                ].join(" ")}
              >
                {card.label}
              </span>
              <span
                className={[
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                  CHIP_STYLE[card.status],
                ].join(" ")}
              >
                {CHIP[card.status]}
              </span>
            </>
          );
          const cardClass = [
            "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2",
            card.status === "current"
              ? "border-brand bg-brand/5"
              : "border-line-muted bg-surface-base",
          ].join(" ");

          return (
            <li key={card.phase}>
              {card.status === "done" ? (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`${card.label}, 완료. 이 단계로 돌아가기`}
                  className={`${cardClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60`}
                  onClick={() => onGoTo(card.phase)}
                >
                  {body}
                </button>
              ) : (
                <div
                  className={cardClass}
                  aria-current={card.status === "current" ? "step" : undefined}
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
