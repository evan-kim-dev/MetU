"use client";

import Link from "next/link";
import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body className="bg-surface-base text-ink-body antialiased">
        <div className="flex min-h-dvh justify-center bg-canvas">
          <div className="relative flex h-dvh w-full max-w-mobile flex-col items-center justify-center gap-5 overflow-hidden bg-surface-base px-6 text-center shadow-soft">
            <p className="text-[11px] font-bold tracking-[0.08em] text-brand">
              Met U
            </p>
            <h1 className="text-xl font-extrabold tracking-tight text-ink-heading">
              앱을 불러오지 못했어요
            </h1>
            <p className="max-w-[280px] text-sm leading-relaxed text-ink-caption">
              일시적인 오류일 수 있어요. 다시 시도해 주세요.
            </p>
            <div className="flex w-full max-w-[280px] flex-col gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-13 min-h-[52px] items-center justify-center rounded-2xl ai-gradient-bg px-6 text-base font-bold text-surface-white shadow-glow transition-all active:brightness-95"
              >
                다시 시도
              </button>
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-line-muted bg-surface-white text-sm font-bold text-brand-strong transition-colors active:bg-surface-soft"
              >
                홈으로 가기
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
