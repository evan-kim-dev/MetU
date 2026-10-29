"use client";

import Link from "next/link";

import { MobileShell } from "@/components/layout/MobileShell";
import { IOS_SHORTCUT_ICLOUD_URL } from "@/lib/onboarding/constants";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function ShortcutGuidePage() {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://met-u.vercel.app";
  const endpoint = `${origin}/api/ingest/sms`;
  const sample = `{
  "text": "MTU-TEST 연결 확인",
  "receivedAt": "2026-10-30T12:00:00+09:00"
}`;

  return (
    <MobileShell title="iOS 단축어 안내" showBack backHref="/onboarding/automation">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-4 text-sm text-ink-body">
        <p>
          가장 빠른 방법은 온보딩의 <strong>iPhone 자동화 추가</strong> 버튼이에요.
          연결 코드를 복사한 뒤 iCloud 단축어 추가 화면으로 이동합니다.
        </p>
        <a href={IOS_SHORTCUT_ICLOUD_URL} className="block">
          <PrimaryButton fullWidth>단축어 추가 링크 열기</PrimaryButton>
        </a>
        <ol className="list-decimal space-y-2 pl-5">
          <li>&quot;단축어 추가&quot; → 연결 코드 칸에 붙여넣기</li>
          <li>자동화의 앱을 내 카드 앱으로 바꾸기</li>
          <li>&quot;실행 전에 확인&quot; 끄기</li>
          <li>
            POST{" "}
            <code className="break-all rounded bg-surface-soft px-1 text-xs">
              {endpoint}
            </code>
          </li>
          <li>Authorization: Bearer 연결 코드</li>
          <li>본문 JSON: text, receivedAt</li>
        </ol>
        <pre className="overflow-x-auto rounded-xl bg-surface-soft p-3 text-xs leading-5 text-ink-heading">
          {sample}
        </pre>
        <PrimaryButton
          fullWidth
          variant="secondary"
          onClick={() => void navigator.clipboard.writeText(sample)}
        >
          샘플 JSON 복사
        </PrimaryButton>
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
