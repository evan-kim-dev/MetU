"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppPicker } from "@/components/onboarding/connect/AppPicker";
import { GuideSideCard } from "@/components/onboarding/connect/GuideSideCard";
import { ShortcutsAppActions } from "@/components/onboarding/connect/ShortcutsAppActions";
import { StickyActionBar } from "@/components/onboarding/connect/StickyActionBar";
import { useClipboardCopy } from "@/components/onboarding/connect/useClipboardCopy";
import { ShortcutGuide } from "@/components/onboarding/guide/ShortcutGuide";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { DetectedPlatform } from "@/lib/onboarding/automation";
import { ANDROID_MACRODROID_URL } from "@/lib/onboarding/constants";
import { buildNotificationBody } from "@/lib/onboarding/dev-snippets";
import {
  ANDROID_PWA_FLOW_SECTION,
  IOS_SMS_AUTOMATION_SECTION,
} from "@/lib/onboarding/guide-content";

type Props = {
  platform: DetectedPlatform;
  token: string | null;
  selectedApps: string[];
  onSelectedApps: (apps: string[]) => void;
  onConfirm: () => void;
};

function CopyBtn({
  labelIdle,
  text,
  disabled,
}: {
  labelIdle: string;
  text: string;
  disabled?: boolean;
}) {
  const { copy, label } = useClipboardCopy();
  return (
    <button
      type="button"
      disabled={disabled}
      className="min-h-11 rounded-xl bg-surface-soft px-3 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:text-ink-caption"
      onClick={() => void copy(text)}
    >
      {label ?? labelIdle}
    </button>
  );
}

export function StepAutomation({
  platform,
  token,
  selectedApps,
  onSelectedApps,
  onConfirm,
}: Props) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const isAndroid = platform === "android";
  const onlyStepIds = isAndroid
    ? ["and-a1", "and-a2", "and-a3", "and-a4", "and-b1", "and-b2", "and-b3", "and-b4", "and-b5"]
    : ["ios-b1", "ios-b2", "ios-b3", "ios-b4", "ios-b5", "ios-b6", "ios-b7"];

  const faqHref = isAndroid
    ? "/onboarding/shortcut-guide?platform=android&faq=and-faq-3"
    : "/onboarding/shortcut-guide?platform=ios&faq=ios-faq-1";

  return (
    <div className="flex flex-col gap-4 pb-28">
      <h2 tabIndex={-1} className="text-xl font-extrabold text-ink-heading">
        {isAndroid ? "매크로 만들기" : "자동화 만들기"}
      </h2>

      {selectedApps.length > 0 ? (
        <p className="text-sm text-ink-body">
          선택한 앱: {selectedApps.join(", ")}
        </p>
      ) : null}

      {isAndroid ? (
        <>
          <GuideSideCard section={ANDROID_PWA_FLOW_SECTION} />
          <a
            href={ANDROID_MACRODROID_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-surface-soft px-4 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Play 스토어에서 MacroDroid 받기
          </a>
        </>
      ) : null}

      <ShortcutsAppActions platform={platform} />

      <ShortcutGuide
        variant="embedded"
        defaultPlatform={isAndroid ? "android" : "ios"}
        onlyStepIds={onlyStepIds}
        features={{ revokeOnReissue: true }}
        defaultCollapsed={false}
      />

      <AppPicker selected={selectedApps} onChange={onSelectedApps} />

      {platform === "ios" ? (
        <GuideSideCard section={IOS_SMS_AUTOMATION_SECTION} />
      ) : null}

      {isAndroid ? (
        <div className="flex flex-col gap-2">
          <CopyBtn
            labelIdle="알림 보내는 주소 복사"
            text={origin ? `${origin}/api/ingest/notification` : ""}
            disabled={!origin || !token}
          />
          <CopyBtn
            labelIdle="헤더 값 복사"
            text={token ? `Bearer ${token}` : ""}
            disabled={!token}
          />
          <CopyBtn
            labelIdle="본문 형식 복사"
            text={buildNotificationBody()}
            disabled={!token}
          />
        </div>
      ) : null}

      <StickyActionBar>
        <PrimaryButton type="button" onClick={onConfirm}>
          {isAndroid ? "매크로를 만들었어요" : "자동화를 만들었어요"}
        </PrimaryButton>
        <Link
          href={faqHref}
          className="inline-flex min-h-11 items-center justify-center text-sm text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          막혔어요
        </Link>
      </StickyActionBar>
    </div>
  );
}
