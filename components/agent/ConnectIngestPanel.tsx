"use client";

import { useCallback, useEffect, useState } from "react";

import { ShortcutGuide } from "@/components/onboarding/guide/ShortcutGuide";
import { CopyButton } from "@/components/onboarding/guide/CopyButton";
import { apiFetchJson } from "@/lib/api/fetch-json";
import type { UserFacingError } from "@/lib/errors/user-message";

type TokenRow = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function formatCreated(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function ConnectIngestPanel({ tripId }: { tripId?: string | null }) {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [plainOnce, setPlainOnce] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs =
      tripId != null && tripId.length > 0
        ? `?tripId=${encodeURIComponent(tripId)}`
        : "";
    const res = await apiFetchJson<{ tokens: TokenRow[] }>(
      `/api/agent/tokens${qs}`,
      undefined,
      { source: "api" }
    );
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTokens(res.data.tokens ?? []);
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createToken() {
    setBusy(true);
    setError(null);
    setPlainOnce(null);
    try {
      const body: { label: string; tripId?: string } = { label: "자동 수집" };
      if (tripId) body.tripId = tripId;
      const res = await apiFetchJson<{ token?: string; error?: string }>(
        "/api/agent/tokens",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { source: "api" }
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!res.data.token) {
        setError({
          code: "unknown",
          message: "연결 코드를 만들지 못했어요.",
          retryable: true,
        });
        return;
      }
      setPlainOnce(res.data.token);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await apiFetchJson(`/api/agent/tokens/${id}`, { method: "DELETE" });
      setRevokeTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 px-4 py-6 text-sm text-ink-body">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink-heading">
          카드 알림 자동 연결
        </h1>
        <p className="text-ink-muted">
          {tripId
            ? "이 여행에 카드 알림을 자동으로 모아요. 연결 코드는 만들 때 한 번만 보여 드려요."
            : "카드 알림을 먼저 연결해요. 여행은 나중에 만들어도 이어서 기록돼요."}
        </p>
      </header>

      {error ? (
        <div className="rounded-xl bg-red-50 p-3 text-red-800" role="alert">
          <p>{error.message}</p>
          {error.retryable ? (
            <button
              type="button"
              className="mt-2 min-h-11 rounded-lg bg-white px-3 py-2 text-sm font-medium"
              onClick={() => void load()}
            >
              다시 시도
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-2">
        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void createToken()}
          className="min-h-touch w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "만드는 중…" : "연결 코드 만들기"}
        </button>
        {plainOnce ? (
          <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-amber-950">
            <p className="font-medium">
              이 화면을 벗어나면 다시 볼 수 없어요
            </p>
            <code
              className="block break-all font-mono text-xs"
              aria-label="연결 코드"
            >
              {plainOnce}
            </code>
            <CopyButton text={plainOnce} label="연결 코드 복사" />
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-ink-heading">내 연결 코드</h2>
        {loading ? (
          <div className="space-y-2" aria-hidden>
            <div className="h-12 animate-pulse rounded-xl bg-surface-soft" />
            <div className="h-12 animate-pulse rounded-xl bg-surface-soft" />
            <div className="h-12 animate-pulse rounded-xl bg-surface-soft" />
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-ink-muted">아직 만든 연결 코드가 없어요</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-line-muted px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink-heading">
                      {t.label || "이름 없음"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      만든 날짜 {formatCreated(t.createdAt)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {t.revoked
                        ? "중지됨"
                        : t.lastUsedAt
                          ? `마지막 사용 ${relativeTime(t.lastUsedAt)}`
                          : "아직 사용 안 함"}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${
                        t.revoked
                          ? "bg-surface-soft text-ink-muted"
                          : "bg-green-50 text-green-900"
                      }`}
                    >
                      {t.revoked ? "중지됨" : "사용 중"}
                    </span>
                  </div>
                  {!t.revoked ? (
                    revokeTarget === t.id ? (
                      <div className="max-w-[11rem] space-y-2 text-xs">
                        <p>
                          정말 중지할까요? 이 코드를 쓰는 단축어는 더 이상
                          동작하지 않아요.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            className="min-h-11 flex-1 rounded-lg bg-red-600 px-2 text-white"
                            onClick={() => void revoke(t.id)}
                          >
                            중지
                          </button>
                          <button
                            type="button"
                            className="min-h-11 flex-1 rounded-lg border border-line-muted px-2"
                            onClick={() => setRevokeTarget(null)}
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        className="min-h-11 shrink-0 rounded-lg px-3 text-red-600"
                        onClick={() => setRevokeTarget(t.id)}
                      >
                        사용 중지
                      </button>
                    )
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ShortcutGuide
        variant="embedded"
        defaultCollapsed
        devToken={plainOnce}
      />
    </div>
  );
}
