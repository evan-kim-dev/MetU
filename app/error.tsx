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
    <div className="mu-root flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <p className="text-mu-caption font-bold text-mu-accent">Met U</p>
      <h1 className="text-mu-title font-extrabold tracking-tight text-mu-fg">
        잠시 문제가 생겼어요
      </h1>
      <p className="max-w-copy text-mu-body leading-relaxed text-mu-fg-3">
        네트워크나 서버 응답이 불안정할 수 있어요. 다시 시도하거나 홈으로
        돌아가 주세요.
      </p>
      <div className="flex w-full max-w-copy flex-col gap-2">
        <PrimaryButton onClick={reset}>다시 시도</PrimaryButton>
        <Link
          href="/"
          className="mu-focus inline-flex h-12 min-h-tap items-center justify-center rounded-mu-lg border border-mu-line bg-mu-card text-mu-label font-bold text-mu-accent transition-colors active:bg-mu-sunken"
        >
          홈으로 가기
        </Link>
      </div>
    </div>
  );
}
