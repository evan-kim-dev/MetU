"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DevSnippet } from "@/components/onboarding/guide/DevSnippet";
import { GuideFaq } from "@/components/onboarding/guide/GuideFaq";
import {
  GuideProgressBar,
  useGuideProgress,
} from "@/components/onboarding/guide/GuideProgress";
import { GuideStepCard } from "@/components/onboarding/guide/GuideStepCard";
import { PlatformTabs } from "@/components/onboarding/guide/PlatformTabs";
import {
  ANDROID_GUIDE,
  detectPlatform,
  GUIDE_OVERVIEW,
  IOS_GUIDE,
  type GuidePlatform,
} from "@/lib/onboarding/guide-content";

export type ShortcutGuideFeatures = {
  revokeOnReissue?: boolean;
};

export type ShortcutGuideProps = {
  variant: "page" | "embedded";
  defaultPlatform?: GuidePlatform;
  features?: ShortcutGuideFeatures;
  onOpenShortcut?: () => void;
  initialFaqId?: string;
  devToken?: string | null;
  defaultCollapsed?: boolean;
  /** When set, only these step ids are shown (embedded connect flow). */
  onlyStepIds?: string[];
};

function renderIntroText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function ShortcutGuide({
  variant,
  defaultPlatform,
  features,
  initialFaqId: initialFaqProp,
  devToken,
  defaultCollapsed = false,
  onlyStepIds,
}: ShortcutGuideProps) {
  const searchParams = useSearchParams();
  const revokeOnReissue = features?.revokeOnReissue ?? false;
  const filtered = Boolean(onlyStepIds && onlyStepIds.length > 0);

  const [platform, setPlatform] = useState<GuidePlatform>(
    defaultPlatform ?? "ios"
  );
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(
    variant === "embedded" && defaultCollapsed
  );

  useEffect(() => {
    setMounted(true);
    if (defaultPlatform) {
      setPlatform(defaultPlatform);
      return;
    }
    const qp = searchParams.get("platform");
    if (qp === "ios" || qp === "android") {
      setPlatform(qp);
      return;
    }
    const detected = detectPlatform(navigator.userAgent);
    if (detected === "android" || detected === "ios") {
      setPlatform(detected);
    }
  }, [defaultPlatform, searchParams]);

  const guide = platform === "ios" ? IOS_GUIDE : ANDROID_GUIDE;
  const visibleSteps = useMemo(() => {
    if (!onlyStepIds || onlyStepIds.length === 0) return guide.steps;
    const allow = new Set(onlyStepIds);
    return guide.steps.filter((s) => allow.has(s.id));
  }, [guide.steps, onlyStepIds]);
  const stepIds = useMemo(
    () => visibleSteps.map((s) => s.id),
    [visibleSteps]
  );
  const progress = useGuideProgress(platform, stepIds);

  const faqParam = searchParams.get("faq");
  const resolvedFaqId = useMemo(() => {
    if (initialFaqProp) return initialFaqProp;
    if (!faqParam) return undefined;
    if (faqParam.includes("-faq-")) return faqParam;
    const n = faqParam.replace(/\D/g, "");
    if (!n) return undefined;
    return `${platform === "ios" ? "ios" : "and"}-faq-${n}`;
  }, [faqParam, initialFaqProp, platform]);

  const firstIncomplete = stepIds.findIndex((id) => !progress.isDone(id));

  const body = (
    <div className="flex flex-col gap-3">
      {!filtered ? (
        <div className="rounded-2xl border border-line-muted bg-surface-base p-4">
          <h2 className="text-base font-extrabold text-ink-heading">
            {GUIDE_OVERVIEW.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-body">
            {GUIDE_OVERVIEW.description}
          </p>
          {platform === "android" ? (
            <p className="mt-2 text-sm text-ink-body">
              Android는 MacroDroid 앱이 알림을 읽어서 MetU로 전송해요.
            </p>
          ) : null}
          <ul className="mt-3 space-y-2 text-sm text-ink-body">
            {GUIDE_OVERVIEW.checklist.map((item) => (
              <li key={item.slice(0, 20)} className="flex gap-2">
                <span aria-hidden>☐</span>
                <span>{renderIntroText(item)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-medium text-ink-heading">
              {GUIDE_OVERVIEW.timeChip}
            </span>
            <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-medium text-ink-heading">
              {GUIDE_OVERVIEW.difficultyChip}
            </span>
          </div>
        </div>
      ) : null}

      {!filtered ? (
        <GuideProgressBar
          done={progress.doneCount}
          total={progress.total}
          onReset={progress.resetAll}
        />
      ) : null}

      {!filtered ? (
        <PlatformTabs value={platform} onChange={setPlatform} />
      ) : null}

      {guide.parts.map((part) => {
        const partSteps = visibleSteps.filter((s) => s.part === part.id);
        if (
          partSteps.length === 0 &&
          part.id === "D" &&
          guide.outro &&
          !filtered
        ) {
          return (
            <section key={part.id} className="space-y-3">
              <h3 className="text-sm font-bold text-ink-muted">{part.title}</h3>
              <p className="text-sm leading-relaxed text-ink-body">
                {renderIntroText(guide.outro)}
              </p>
            </section>
          );
        }
        if (partSteps.length === 0) return null;
        return (
          <section key={part.id} className="space-y-3">
            {!filtered ? (
              <h3 className="text-sm font-bold text-ink-muted">{part.title}</h3>
            ) : null}
            {partSteps.map((step) => {
              const globalIndex = visibleSteps.findIndex(
                (s) => s.id === step.id
              );
              return (
                <GuideStepCard
                  key={step.id}
                  step={step}
                  index={globalIndex}
                  defaultOpen={globalIndex === firstIncomplete}
                  done={progress.isDone(step.id)}
                  revokeOnReissue={revokeOnReissue}
                  onToggleDone={(d) => progress.toggleDone(step.id, d)}
                />
              );
            })}
          </section>
        );
      })}

      {!filtered ? (
        <GuideFaq
          items={guide.faq}
          initialFaqId={resolvedFaqId}
          revokeOnReissue={revokeOnReissue}
        />
      ) : null}

      {!filtered ? <DevSnippet token={devToken} /> : null}
    </div>
  );

  if (variant === "embedded" && collapsed) {
    return (
      <div className="rounded-2xl border border-line-muted bg-surface-base p-3">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between text-sm font-semibold text-ink-heading"
          onClick={() => setCollapsed(false)}
        >
          <span>연결 가이드 펼치기</span>
          <span aria-hidden>▼</span>
        </button>
      </div>
    );
  }

  if (variant === "embedded") {
    return (
      <div className="space-y-3 rounded-2xl border border-line-muted bg-surface-base p-3">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between text-sm font-semibold text-ink-heading"
          onClick={() => setCollapsed(true)}
        >
          <span>연결 가이드 접기</span>
          <span aria-hidden>▲</span>
        </button>
        {body}
      </div>
    );
  }

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+5rem)]">
      {!mounted ? (
        <div className="h-8 animate-pulse rounded bg-surface-soft" aria-hidden />
      ) : null}
      {body}
    </div>
  );
}
