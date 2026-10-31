"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SkeletonBlock } from "@/components/ui/PageSkeleton";
import { ExpenseFxLine } from "@/components/trips/ledger/ExpenseFxLine";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import { SectionRetry } from "./SectionRetry";
import type { SectionState } from "./useLedgerHomeData";

const MAX_ROWS = 5;

type Props = {
  tripId: string;
  expenses: SectionState<LedgerExpenseRow[]>;
  members: SectionState<TripMember[]>;
  onRetry: () => void;
  /** 자동 기록이 꺼져 있으면 빈 상태에서 연결 링크를 보여 준다 */
  automationOff: boolean;
};

function shortDate(iso: string | undefined): string | null {
  const m = iso ? /^\d{4}-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${Number(m[1])}/${Number(m[2])}` : null;
}

const LINK =
  "inline-flex min-h-tap items-center rounded-xl px-1 text-sm font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function RecentExpenses({
  tripId,
  expenses,
  members,
  onRetry,
  automationOff,
}: Props) {
  // listExpenses 는 생성 순(오래된 것 먼저)이라, 뒤집으면 createdAt 내림차순이에요.
  const recent = useMemo(
    () => [...(expenses.data ?? [])].reverse().slice(0, MAX_ROWS),
    [expenses.data]
  );
  const nameById = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.id, m.displayName])),
    [members.data]
  );

  return (
    <section
      aria-label="최근 지출"
      className="flex flex-col rounded-2xl bg-surface-white p-4 shadow-soft ring-1 ring-line-soft"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-ink-heading">최근 지출</h2>
        <Link href={`/trips/${tripId}/ledger`} className={LINK}>
          전체 보기
        </Link>
      </div>

      {expenses.status === "loading" ? (
        <div className="mt-2 flex flex-col gap-2" aria-busy="true">
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonBlock className="h-14 w-full" />
        </div>
      ) : expenses.status === "error" ? (
        <SectionRetry onRetry={onRetry} />
      ) : recent.length === 0 ? (
        <div className="flex flex-col gap-1 py-2">
          <p className="text-sm font-bold text-ink-heading">
            아직 지출이 없어요
          </p>
          <p className="text-xs text-ink-body">
            영수증을 찍거나 직접 추가해 보세요
          </p>
          {automationOff ? (
            <Link href="/onboarding/automation" className={LINK}>
              카드 알림 연결하기
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="mt-1 divide-y divide-line-soft">
          {recent.map((e) => {
            const date = shortDate(e.spentOn);
            const payer = nameById.get(e.paidBy);
            return (
              <li key={e.id} className="flex flex-col py-1">
                <div className="flex min-h-tap items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-soft text-sm font-bold text-brand"
                  >
                    {(e.category || "기타").slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink-heading">
                      {e.merchant || e.label || "이름 없는 지출"}
                    </p>
                    <p className="truncate text-xs text-ink-caption">
                      {[date, payer].filter(Boolean).join(" · ") || "미상"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-ink-heading">
                    {formatKRW(e.krwAmount)}
                  </p>
                </div>
                <ExpenseFxLine expense={e} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
