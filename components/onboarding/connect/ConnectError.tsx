"use client";

import { useEffect, useState } from "react";

import type { UserFacingError } from "@/lib/errors/user-message";

type Props = {
  error: UserFacingError;
  onRetry?: () => void;
  onOpenGuide?: () => void;
  onReissue?: () => void;
  onLogin?: () => void;
};

export function ConnectError({
  error,
  onRetry,
  onOpenGuide,
  onReissue,
  onLogin,
}: Props) {
  const [remain, setRemain] = useState(error.retryAfterSec ?? 0);

  useEffect(() => {
    setRemain(error.retryAfterSec ?? 0);
  }, [error.retryAfterSec, error.code, error.message]);

  useEffect(() => {
    if (remain <= 0) return;
    const t = setInterval(() => {
      setRemain((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [remain > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const action = error.action;
  let button: React.ReactNode = null;

  if (action === "retry" && onRetry) {
    const waiting = remain > 0;
    button = (
      <button
        type="button"
        className="mt-2 min-h-11 rounded-xl bg-surface-soft px-4 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:text-ink-caption"
        disabled={waiting}
        onClick={onRetry}
      >
        {waiting ? (
          <>
            <span className="sr-only">
              {remain === (error.retryAfterSec ?? 0)
                ? "다시 시도 대기 시작"
                : remain === 0
                  ? "다시 시도 가능"
                  : ""}
            </span>
            <span aria-hidden>다시 시도 ({remain}초)</span>
          </>
        ) : (
          "다시 시도"
        )}
      </button>
    );
  } else if (action === "open-guide" && onOpenGuide) {
    button = (
      <button
        type="button"
        className="mt-2 min-h-11 rounded-xl bg-surface-soft px-4 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={onOpenGuide}
      >
        가이드 보기
      </button>
    );
  } else if (action === "reissue-code" && onReissue) {
    button = (
      <button
        type="button"
        className="mt-2 min-h-11 rounded-xl bg-surface-soft px-4 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={onReissue}
      >
        연결 코드 다시 만들기
      </button>
    );
  } else if (action === "login" && onLogin) {
    button = (
      <button
        type="button"
        className="mt-2 min-h-11 rounded-xl bg-surface-soft px-4 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={onLogin}
      >
        다시 로그인
      </button>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-ink-heading"
    >
      <p>{error.message}</p>
      {button}
      {error.operatorHint ? (
        <details className="mt-2 text-xs text-ink-body">
          <summary className="cursor-pointer">운영자용 정보</summary>
          <p className="mt-1 break-all">{error.operatorHint}</p>
        </details>
      ) : null}
    </div>
  );
}
