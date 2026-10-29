"use client";

import Link from "next/link";

import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function ShortcutGuidePage() {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://met-u.vercel.app";
  const endpoint = `${origin}/api/ingest/notification`;
  const sample = `{
  "app": "KB Pay",
  "title": "결제 알림",
  "body": "MTU-TEST 연결 확인",
  "received_at": "2026-10-30T12:00:00+09:00"
}`;

  return (
    <MobileShell title="iOS 단축어 안내" showBack backHref="/onboarding/automation">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-4 text-sm text-ink-body">
        <p>
          알림을 받으면 MetU로 POST 하는 개인 자동화를 만들어요. 자세한 단계와
          오류 대응은 저장소 문서{" "}
          <code className="rounded bg-surface-soft px-1 text-xs">
            docs/ios-shortcut-build.md
          </code>
          에도 있어요.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>단축어 → 자동화 → 개인 자동화 → 앱 알림 수신</li>
          <li>카드 앱을 고르고 &quot;실행 전에 묻기&quot; 끄기</li>
          <li>
            URL 내용 가져오기 POST →{" "}
            <code className="break-all rounded bg-surface-soft px-1 text-xs">
              {endpoint}
            </code>
          </li>
          <li>Authorization: Bearer 연결 코드</li>
          <li>JSON 본문에 app, title, body, received_at</li>
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
        <Link href="/onboarding/automation" className="text-center text-xs font-bold text-brand">
          자동화 설정으로 돌아가기
        </Link>
      </div>
    </MobileShell>
  );
}
