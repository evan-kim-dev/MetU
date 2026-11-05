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
      <body className="bg-mu-bg text-mu-fg antialiased">
        <div className="mu-root flex min-h-dvh justify-center bg-mu-bg">
          <div className="relative flex h-dvh w-full max-w-mobile flex-col items-center justify-center gap-5 overflow-hidden bg-mu-bg px-6 text-center">
            <p className="text-mu-caption font-bold text-mu-accent">Met U</p>
            <h1 className="text-mu-title font-extrabold tracking-tight text-mu-fg">
              앱을 불러오지 못했어요
            </h1>
            <p className="max-w-copy text-mu-body leading-relaxed text-mu-fg-3">
              일시적인 오류일 수 있어요. 다시 시도해 주세요.
            </p>
            <div className="flex w-full max-w-copy flex-col gap-2">
              <button
                type="button"
                onClick={reset}
                className="mu-focus inline-flex h-14 min-h-touch items-center justify-center rounded-mu-lg bg-mu-accent px-6 text-mu-body font-bold text-mu-on-accent transition-colors active:bg-mu-accent-strong"
              >
                다시 시도
              </button>
              <Link
                href="/"
                className="mu-focus inline-flex h-12 min-h-tap items-center justify-center rounded-mu-lg border border-mu-line bg-mu-card text-mu-label font-bold text-mu-accent transition-colors active:bg-mu-sunken"
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
