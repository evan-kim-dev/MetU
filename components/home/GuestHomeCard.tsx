"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

export function GuestHomeCard() {
  const { isReady, provider } = useAuth();
  if (!isReady || provider !== "guest") return null;

  return (
    <section
      aria-label="게스트 안내"
      className="rounded-2xl bg-surface-white p-4 shadow-sm ring-1 ring-line-soft"
    >
      <h2 className="text-base font-extrabold text-ink-heading">
        둘러보는 중이에요
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-body">
        로그인하면 여행과 가계부가 저장되고, 카드 알림 자동 기록도 쓸 수 있어요.
      </p>
      <Link
        href="/login?next=/"
        className="ai-gradient-bg mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-2xl text-sm font-bold text-surface-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        로그인하고 시작하기
      </Link>
    </section>
  );
}
