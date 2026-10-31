"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DetectedPlatform } from "@/lib/onboarding/automation";
import {
  buildRunShortcutUrl,
  IOS_SHORTCUT_NAME,
  IOS_SHORTCUTS_APP_URL,
} from "@/lib/onboarding/constants";

type Props = {
  platform: DetectedPlatform;
};

/** 탭 후 이 시간 안에 페이지가 가려지지 않으면 앱이 안 열린 것으로 보고 안내해요. */
export const SHORTCUTS_OPEN_HINT_MS = 1500;

const LINK_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-surface-soft px-4 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/**
 * iOS 전용. PWA 는 설정 앱을 열 수 없어서 단축어 앱(shortcuts://)만 열어요.
 * 링크는 사용자가 직접 탭할 때만 이동하고, 마운트/타이머로는 이동하지 않아요.
 */
export function ShortcutsAppActions({ platform }: Props) {
  const [showOpenHint, setShowOpenHint] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const clearWatch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  useEffect(() => clearWatch, [clearWatch]);

  if (platform !== "ios") return null;

  const onOpenTap = () => {
    clearWatch();
    setShowOpenHint(false);
    const onVis = () => {
      if (document.visibilityState === "hidden") clearWatch();
    };
    document.addEventListener("visibilitychange", onVis);
    cleanupRef.current = () =>
      document.removeEventListener("visibilitychange", onVis);
    timerRef.current = setTimeout(() => {
      setShowOpenHint(true);
      clearWatch();
    }, SHORTCUTS_OPEN_HINT_MS);
  };

  return (
    <section
      aria-label="단축어 앱 바로가기"
      className="flex flex-col gap-2 rounded-2xl border border-line-muted bg-surface-base p-4"
    >
      <a
        href={IOS_SHORTCUTS_APP_URL}
        className={LINK_CLASS}
        onClick={onOpenTap}
      >
        단축어 앱 열기
      </a>
      <p className="text-xs text-ink-muted">처음엔 iOS 확인 팝업이 떠요</p>
      {showOpenHint ? (
        <p role="status" className="text-sm text-ink-body">
          단축어 앱이 열리지 않으면 홈 화면에서 직접 열어 주세요
        </p>
      ) : null}

      <a href={buildRunShortcutUrl()} className={LINK_CLASS}>
        단축어 실행해서 테스트
      </a>
      <p className="text-xs leading-relaxed text-ink-muted">
        &apos;{IOS_SHORTCUT_NAME}&apos; 이름의 단축어를 실행해요. 설치한 단축어
        이름이 다르면 열리지 않을 수 있어요. 입력 없이 실행하면 오류가 나는 게
        정상이에요. 실제 알림으로 확인해 주세요.
      </p>
    </section>
  );
}
