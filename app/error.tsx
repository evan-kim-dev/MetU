"use client";

import Link from "next/link";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <p className="text-xs font-bold tracking-label text-brand">
        Met U
      </p>
      <h1 className="text-xl font-extrabold tracking-tight text-ink-heading">
        잠시 문제가 생겼어요
      </h1>
      <p className="max-w-copy text-sm leading-relaxed text-ink-caption">
        네트워크나 서버 응답이 불안정할 수 있어요. 다시 시도하거나 홈으로
        돌아가 주세요.
      </p>
      <div className="flex w-full max-w-copy flex-col gap-2">
        <PrimaryButton onClick={reset}>다시 시도</PrimaryButton>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-2xl border border-line-muted bg-surface-white text-sm font-bold text-brand-strong transition-colors active:bg-surface-soft"
        >
          홈으로 가기
        </Link>
      </div>
    </div>
  );
}
