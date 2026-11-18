"use client";

import Link from "next/link";
import { ChevronRight, Inbox, Scale, Wallet } from "lucide-react";
import { INBOX_NAME } from "@/lib/ledger/inbox-copy";

type Props = {
  tripId: string;
  /** 오늘/다음 일정 한 줄 (없으면 안내) */
  nextScheduleLine: string | null;
  onOpenSchedule: () => void;
};

/**
 * 여행 상세 기본 랜딩(요약). 일정·확인함·가계부·정산 입구를 카드 1개씩.
 */
export function TripSummaryPanel({
  tripId,
  nextScheduleLine,
  onOpenSchedule,
}: Props) {
  const ledgerHref = `/trips/${tripId}/ledger`;
  const settleHref = `/trips/${tripId}/ledger?step=settle`;
  const inboxHref = `/trips/${tripId}/ledger/inbox`;

  return (
    <section aria-label="여행 요약" className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onOpenSchedule}
        className="mu-focus flex min-h-tap w-full items-center justify-between gap-3 rounded-mu-xl border border-mu-line bg-mu-card px-4 py-3 text-left active:opacity-90"
      >
        <div className="min-w-0">
          <p className="text-mu-caption font-bold text-mu-fg-3">오늘 일정</p>
          <p className="mt-0.5 truncate text-mu-body font-bold text-mu-fg">
            {nextScheduleLine ?? "일정을 확인해 보세요"}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-mu-fg-3" aria-hidden />
      </button>

      <Link
        href={inboxHref}
        className="mu-focus flex min-h-tap items-center justify-between gap-3 rounded-mu-xl border border-mu-line bg-mu-card px-4 py-3 active:opacity-90"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mu-warn-soft text-mu-warn">
            <Inbox className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          </span>
          <span>
            <span className="block text-mu-body font-bold text-mu-fg">
              {INBOX_NAME}
            </span>
            <span className="text-mu-caption text-mu-fg-3">
              확인할 알림·제안이 있으면 여기서요
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-mu-fg-3" aria-hidden />
      </Link>

      <Link
        href={ledgerHref}
        className="mu-focus flex min-h-tap items-center justify-between gap-3 rounded-mu-xl border border-mu-line bg-mu-card px-4 py-3 active:opacity-90"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mu-accent-soft text-mu-accent">
            <Wallet className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          </span>
          <span>
            <span className="block text-mu-body font-bold text-mu-fg">
              가계부
            </span>
            <span className="text-mu-caption text-mu-fg-3">
              확정 지출 · 기록 · 분담
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-mu-fg-3" aria-hidden />
      </Link>

      <Link
        href={settleHref}
        className="mu-focus flex min-h-tap items-center justify-between gap-3 rounded-mu-xl border border-mu-accent/30 bg-mu-accent-soft px-4 py-3 active:opacity-90"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mu-card text-mu-accent">
            <Scale className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          </span>
          <span>
            <span className="block text-mu-body font-bold text-mu-fg">정산</span>
            <span className="text-mu-caption text-mu-fg-3">
              내 몫 확인 · 송금 · 공유
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-mu-accent" aria-hidden />
      </Link>
    </section>
  );
}
