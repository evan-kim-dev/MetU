"use client";

import { renderMarkdownish } from "@/components/onboarding/guide/GuideStepCard";
import type { GuideSideSection } from "@/lib/onboarding/guide-content";

type Props = {
  section: GuideSideSection;
};

/** 짧은 텍스트 안내 카드. 설정 앱을 열어 준다는 약속은 하지 않아요. */
export function GuideSideCard({ section }: Props) {
  return (
    <section
      aria-labelledby={`${section.id}-title`}
      className="rounded-2xl border border-line-muted bg-surface-base p-4"
    >
      <h3
        id={`${section.id}-title`}
        className="text-sm font-extrabold text-ink-heading"
      >
        {section.title}
      </h3>
      {section.intro ? (
        <p className="mt-1 text-sm leading-relaxed text-ink-body">
          {renderMarkdownish(section.intro)}
        </p>
      ) : null}
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-body">
        {section.items.map((item) => (
          <li key={item}>{renderMarkdownish(item)}</li>
        ))}
      </ol>
      {section.note ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          {section.note}
        </p>
      ) : null}
    </section>
  );
}
