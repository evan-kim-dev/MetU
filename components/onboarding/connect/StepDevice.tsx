"use client";

import { useState } from "react";

import { StickyActionBar } from "@/components/onboarding/connect/StickyActionBar";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { DetectedPlatform } from "@/lib/onboarding/automation";

type Props = {
  platform: DetectedPlatform;
  onIos27: (value: boolean) => void;
  onAndroidNext: () => void;
};

export function StepDevice({ platform, onIos27, onAndroidNext }: Props) {
  const [dontKnowOpen, setDontKnowOpen] = useState(false);

  if (platform === "android") {
    return (
      <div className="flex flex-col gap-4 pb-28">
        <h2 tabIndex={-1} className="text-xl font-extrabold text-ink-heading">
          연결할 기기를 확인했어요: Android
        </h2>
        <p className="text-sm leading-relaxed text-ink-body">
          Android는 MacroDroid 앱이 알림을 읽어서 MetU로 보내요. 무료 앱이에요.
        </p>
        <StickyActionBar>
          <PrimaryButton type="button" onClick={onAndroidNext}>
            다음
          </PrimaryButton>
        </StickyActionBar>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <h2 tabIndex={-1} className="text-xl font-extrabold text-ink-heading">
        연결할 기기를 확인했어요: iPhone
      </h2>
      <p className="text-sm leading-relaxed text-ink-body">
        iPhone의 iOS 버전이 27 이상인가요?
      </p>
      <div role="radiogroup" aria-label="iOS 버전" className="flex flex-col gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={false}
          className="flex h-12 min-h-12 items-center rounded-xl border border-line-muted bg-surface-base px-4 text-left text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => onIos27(true)}
        >
          27 이상이에요
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={false}
          className="flex h-12 min-h-12 items-center rounded-xl border border-line-muted bg-surface-base px-4 text-left text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => onIos27(false)}
        >
          27보다 낮아요
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={dontKnowOpen}
          className="flex h-12 min-h-12 items-center rounded-xl border border-line-muted bg-surface-base px-4 text-left text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => setDontKnowOpen(true)}
        >
          잘 모르겠어요
        </button>
      </div>
      {dontKnowOpen ? (
        <p className="rounded-xl bg-surface-soft p-3 text-sm text-ink-body">
          설정 → 일반 → 정보 → iOS 버전에서 확인해요
        </p>
      ) : null}
    </div>
  );
}
