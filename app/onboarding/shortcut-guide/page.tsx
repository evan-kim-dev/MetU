"use client";

import Link from "next/link";
import { Suspense } from "react";

import { ShortcutGuide } from "@/components/onboarding/guide/ShortcutGuide";
import { MobileShell } from "@/components/layout/MobileShell";
import { IOS_SHORTCUT_ICLOUD_URL } from "@/lib/onboarding/constants";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

function ShortcutGuidePageInner() {
  return (
    <MobileShell title="iOS 단축어 안내" showBack backHref="/onboarding/automation">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-4">
        <div className="flex flex-col gap-2">
          <Link href="/onboarding/automation">
            <PrimaryButton fullWidth variant="secondary">
              연결 코드 만들러 가기
            </PrimaryButton>
          </Link>
          <a href={IOS_SHORTCUT_ICLOUD_URL} target="_blank" rel="noopener noreferrer">
            <PrimaryButton fullWidth>단축어 추가 링크 열기</PrimaryButton>
          </a>
          <p className="text-center text-xs text-ink-muted">
            연결 코드를 먼저 복사해 두면 편해요
          </p>
        </div>
        <ShortcutGuide variant="page" />
        <Link
          href="/onboarding/automation"
          className="text-center text-xs font-bold text-brand"
        >
          자동화 설정으로 돌아가기
        </Link>
      </div>
    </MobileShell>
  );
}

export default function ShortcutGuidePage() {
  return (
    <Suspense
      fallback={
        <MobileShell title="iOS 단축어 안내" showBack backHref="/onboarding/automation">
          <div className="px-4 py-6 text-sm text-ink-muted">불러오는 중…</div>
        </MobileShell>
      }
    >
      <ShortcutGuidePageInner />
    </Suspense>
  );
}
