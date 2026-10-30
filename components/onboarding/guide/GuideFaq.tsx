"use client";

import { useEffect, useRef } from "react";

import type { GuideFaqItem } from "@/lib/onboarding/guide-content";
import { resolveFaqCause, resolveFaqFix } from "@/lib/onboarding/guide-content";

type GuideFaqProps = {
  items: GuideFaqItem[];
  initialFaqId?: string;
  revokeOnReissue: boolean;
};

export function GuideFaq({
  items,
  initialFaqId,
  revokeOnReissue,
}: GuideFaqProps) {
  const scrolled = useRef(false);

  useEffect(() => {
    if (!initialFaqId || scrolled.current) return;
    const el = document.getElementById(initialFaqId);
    if (el) {
      scrolled.current = true;
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [initialFaqId]);

  return (
    <section className="space-y-2" aria-label="문제 해결 FAQ">
      <h2 className="text-base font-extrabold text-ink-heading">문제 해결</h2>
      {items.map((item) => {
        const open = initialFaqId === item.id;
        const cause = resolveFaqCause(item, revokeOnReissue);
        const fix = resolveFaqFix(item, revokeOnReissue);
        return (
          <details
            key={item.id}
            id={item.id}
            open={open}
            className="rounded-xl border border-line-muted bg-surface-base p-3"
          >
            <summary className="cursor-pointer text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              {item.symptom.replace(/\*\*/g, "")}
            </summary>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-body">
              {cause ? (
                <p>
                  <span className="font-semibold text-ink-heading">원인: </span>
                  {cause}
                </p>
              ) : null}
              <p>
                <span className="font-semibold text-ink-heading">해결: </span>
                {fix}
              </p>
            </div>
          </details>
        );
      })}
    </section>
  );
}
