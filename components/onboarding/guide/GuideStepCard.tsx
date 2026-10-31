"use client";

import type { GuideMistake, GuideStep } from "@/lib/onboarding/guide-content";
import { resolveStepExpect } from "@/lib/onboarding/guide-content";

export function renderMarkdownish(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="break-all rounded bg-surface-soft px-1 text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function visibleMistakes(
  mistakes: GuideMistake[] | undefined,
  revokeOnReissue: boolean
) {
  return (mistakes ?? []).filter(
    (m) => !m.requiresP4 || revokeOnReissue
  );
}

type GuideStepCardProps = {
  step: GuideStep;
  index: number;
  defaultOpen: boolean;
  done: boolean;
  revokeOnReissue: boolean;
  onToggleDone: (done: boolean) => void;
};

export function GuideStepCard({
  step,
  index,
  defaultOpen,
  done,
  revokeOnReissue,
  onToggleDone,
}: GuideStepCardProps) {
  if (step.requiresP4 && !revokeOnReissue) {
    return null;
  }

  const expect = resolveStepExpect(step, revokeOnReissue);
  const mistakes = visibleMistakes(step.mistakes, revokeOnReissue);

  return (
    <details
      open={defaultOpen}
      className="rounded-2xl border border-line-muted bg-surface-base p-4"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
          aria-hidden
        >
          {index + 1}
        </span>
        <span className="flex-1 text-base font-extrabold text-ink-heading">
          {step.title}
        </span>
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`${step.title} 완료`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleDone(!done);
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line-muted text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {done ? "✓" : ""}
        </button>
      </summary>
      <div className="mt-3 space-y-3 pl-10">
        <div>
          <p className="text-xs font-semibold text-ink-muted">할 일</p>
          <ul className="mt-1 list-disc space-y-2 pl-4 text-sm leading-relaxed text-ink-body">
            {step.doItems.map((item) => (
              <li key={item.slice(0, 24)}>{renderMarkdownish(item)}</li>
            ))}
          </ul>
        </div>
        {expect ? (
          <div className="rounded-xl bg-green-50 p-3 text-sm leading-relaxed text-green-900">
            <p className="font-semibold">
              <span aria-hidden>✓ </span>이렇게 보이면 맞아요
            </p>
            <p className="mt-1">{renderMarkdownish(expect)}</p>
          </div>
        ) : null}
        {mistakes.length > 0 ? (
          <div className="rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">
            <p className="font-semibold">
              <span aria-hidden>⚠ </span>자주 하는 실수
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {mistakes.map((m) => (
                <li key={m.text.slice(0, 32)}>{renderMarkdownish(m.text)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
