"use client";

import Link from "next/link";

import { formatRelativeTime } from "@/lib/format/relative-time";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFirstRunVisible } from "@/lib/onboarding/first-run";

export function AutomationStatusBanner() {
  const { isReady, isLoggedIn, provider } = useAuth();
  const isGuest = provider === "guest";
  const firstRunVisible = useFirstRunVisible();
  const { data, loading, error, uiState } = useAutomationStatus({
    enabled: isReady && isLoggedIn && !isGuest,
    lite: true,
  });

  if (
    !isReady ||
    isGuest ||
    !isLoggedIn ||
    loading ||
    error ||
    !uiState ||
    !data
  ) {
    return null;
  }

  if (uiState === "off") {
    if (firstRunVisible) return null;
    return (
      <section
        aria-label="자동 기록 상태"
        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-surface-soft px-4 py-3"
      >
        <div className="flex min-w-0 items-start gap-2">
          <span aria-hidden className="mt-0.5">
            ⚪
          </span>
          <p className="text-sm text-ink-heading">
            자동 기록이 꺼져 있어요 · 카드 알림을 연결하면 지출이 자동으로 적혀요
          </p>
        </div>
        <Link
          href="/onboarding/automation"
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-surface-base px-3 text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          연결하기
        </Link>
      </section>
    );
  }

  if (uiState === "unverified") {
    if (firstRunVisible) return null;
    return (
      <section
        aria-label="자동 기록 상태"
        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3"
      >
        <div className="flex min-w-0 items-start gap-2">
          <span aria-hidden className="mt-0.5">
            ⚠
          </span>
          <p className="text-sm text-ink-heading">
            연결을 확인하지 못했어요 · 테스트 알림을 한 번 받아 보세요
          </p>
        </div>
        <Link
          href="/onboarding/automation"
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-surface-base px-3 text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          확인하기
        </Link>
      </section>
    );
  }

  if (uiState === "silent") {
    return (
      <section
        aria-label="자동 기록 상태"
        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-orange-50 px-4 py-3"
      >
        <div className="flex min-w-0 items-start gap-2">
          <span aria-hidden className="mt-0.5">
            ⚠
          </span>
          <p className="text-sm text-ink-heading">
            최근 24시간 동안 받은 알림이 없어요 · 자동화가 켜져 있는지 확인해
            보세요
          </p>
        </div>
        <Link
          href="/onboarding/automation"
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-surface-base px-3 text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          관리
        </Link>
      </section>
    );
  }

  // ok — compact chip
  const rel = data.lastNotificationAt
    ? formatRelativeTime(data.lastNotificationAt)
    : "방금 전";
  return (
    <section
      aria-label="자동 기록 상태"
      className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-2"
    >
      <p className="text-sm text-ink-heading">
        <span aria-hidden>✅ </span>
        자동 기록 켜짐 · 마지막 수신 {rel}
      </p>
      <Link
        href="/onboarding/automation"
        className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        관리
      </Link>
    </section>
  );
}
