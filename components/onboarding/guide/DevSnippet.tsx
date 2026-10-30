"use client";

import { useEffect, useState } from "react";

import { CopyButton } from "@/components/onboarding/guide/CopyButton";
import {
  buildCurl,
  buildNotificationBody,
  buildSmsBody,
  DEV_SNIPPET_ENDPOINTS,
} from "@/lib/onboarding/dev-snippets";

type DevSnippetProps = {
  token?: string | null;
};

const FALLBACK_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "<내 도메인>";

export function DevSnippet({ token }: DevSnippetProps) {
  const [origin, setOrigin] = useState(FALLBACK_ORIGIN);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const curlNotification = buildCurl({
    origin,
    token: token ?? undefined,
    path: DEV_SNIPPET_ENDPOINTS.notification,
  });
  const curlSms = buildCurl({
    origin,
    token: token ?? undefined,
    path: DEV_SNIPPET_ENDPOINTS.sms,
  });

  return (
    <details className="rounded-xl border border-line-muted bg-surface-base p-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        개발자용 설정 보기
      </summary>
      <div className="mt-3 space-y-3 text-xs leading-relaxed text-ink-body">
        <p>
          엔드포인트:{" "}
          <code className="break-all">{DEV_SNIPPET_ENDPOINTS.notification}</code>{" "}
          (권장: app·body 필수) /{" "}
          <code className="break-all">{DEV_SNIPPET_ENDPOINTS.sms}</code> (text
          또는 body)
        </p>
        <p>
          헤더: Authorization: Bearer &lt;연결 코드&gt; (대소문자 무시),{" "}
          Content-Type: application/json
        </p>
        <p>
          본문 크기 제한 8KB, 텍스트 2000자. MTU-TEST로 시작하는 본문은 연결
          테스트로만 저장돼요.
        </p>
        <div className="relative">
          <CopyButton
            text={curlNotification}
            label="복사"
            className="absolute right-0 top-0"
          />
          <pre className="whitespace-pre-wrap break-all rounded-lg bg-surface-soft p-3 pt-12 text-xs">
            {curlNotification}
          </pre>
        </div>
        <div className="relative">
          <CopyButton
            text={curlSms}
            label="복사"
            className="absolute right-0 top-0"
          />
          <pre className="whitespace-pre-wrap break-all rounded-lg bg-surface-soft p-3 pt-12 text-xs">
            {curlSms}
          </pre>
        </div>
        <pre className="whitespace-pre-wrap break-all rounded-lg bg-surface-soft p-3 text-xs">
          {buildNotificationBody()}
        </pre>
        <pre className="whitespace-pre-wrap break-all rounded-lg bg-surface-soft p-3 text-xs">
          {buildSmsBody()}
        </pre>
      </div>
    </details>
  );
}
