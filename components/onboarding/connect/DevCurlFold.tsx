"use client";

import { useCallback, useState } from "react";

import { DevSnippet } from "@/components/onboarding/guide/DevSnippet";
import { apiFetchJson } from "@/lib/api/fetch-json";

type Props = {
  onToken?: (token: string) => void;
};

type TokenRes = {
  token: string;
  id: string;
};

export function DevCurlFold({ onToken }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const issue = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetchJson<TokenRes>(
        "/api/agent/tokens",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: "curl 테스트",
            replaceExisting: false,
          }),
        },
        { source: "api" }
      );
      if (!res.ok) {
        setMsg("연결 코드를 만들지 못했어요.");
        return;
      }
      setToken(res.data.token);
      onToken?.(res.data.token);
    } finally {
      setBusy(false);
    }
  }, [busy, onToken]);

  return (
    <details className="rounded-xl border border-line-muted bg-surface-base p-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        개발자용 (curl로 연결 테스트)
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-relaxed text-ink-body">
          MTU-TEST로 시작하는 본문은 수신은 되지만 무시되는 테스트예요.
        </p>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-surface-soft px-4 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:text-ink-caption"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void issue()}
        >
          {busy ? "만드는 중…" : "curl 테스트 코드 만들기"}
        </button>
        {msg ? (
          <p role="alert" className="text-sm text-ink-heading">
            {msg}
          </p>
        ) : null}
        <DevSnippet token={token} />
      </div>
    </details>
  );
}
