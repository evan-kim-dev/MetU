"use client";

import Link from "next/link";
import { ChartColumn, ChevronRight, Inbox, Receipt, X } from "lucide-react";
import { AmountCard } from "@/components/ds/AmountCard";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { Button } from "@/components/ds/Button";
import { EmptyState } from "@/components/ds/EmptyState";
import { ExpenseRow } from "@/components/ds/ExpenseRow";
import type { AddExpenseTab } from "@/components/ledger/journey/host/AddExpenseSheet";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";

type Props = {
  tripId: string;
  expenses: LedgerExpenseRow[];
  members: TripMember[];
  /** 확인할 자동 수집 알림 + 대기 중인 게스트 제안 */
  inboxCount: number;
  cancelNotice: ExpenseDraftInput | null;
  onDismissCancel: () => void;
  onOpenAdd: (tab: AddExpenseTab) => void;
  /** 지출을 누르면 분담 단계로 가요. */
  onAdjust: () => void;
  /** 통계 카드 (LedgerDashboard) */
  dashboard: React.ReactNode;
};

function sortRecent(list: LedgerExpenseRow[]): LedgerExpenseRow[] {
  return [...list].sort((a, b) => {
    const ka = a.paidAt ?? a.spentOn ?? "";
    const kb = b.paidAt ?? b.spentOn ?? "";
    return kb.localeCompare(ka);
  });
}

function expenseMeta(e: LedgerExpenseRow, payer: string | undefined): string {
  const parts: string[] = [];
  if (e.spentOn) parts.push(e.spentOn.slice(5).replace("-", "/"));
  if (e.currency && e.currency !== "KRW" && Number.isFinite(e.amount)) {
    parts.push(`${e.amount.toLocaleString("ko-KR")} ${e.currency}`);
  }
  if (payer) parts.push(`${payer} 결제`);
  return parts.join(" · ");
}

/** 호스트 ③ 기록 단계: 요약 · 확인할 것 · 최근 지출. 입력은 지출 추가 시트에서 해요. */
export function RecordStep({
  tripId,
  expenses,
  members,
  inboxCount,
  cancelNotice,
  onDismissCancel,
  onOpenAdd,
  onAdjust,
  dashboard,
}: Props) {
  const total = expenses.reduce(
    (s, e) => s + (Number.isFinite(e.krwAmount) ? e.krwAmount : 0),
    0
  );
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName;
  const recent = sortRecent(expenses);

  return (
    <div className="flex flex-col gap-6 pb-24">
      <AmountCard
        label="총지출"
        amount={total}
        sub={expenses.length > 0 ? `지출 ${expenses.length}건` : "아직 기록이 없어요"}
      />

      {inboxCount > 0 ? (
        <Link
          href={`/trips/${tripId}/ledger/inbox`}
          className="mu-focus flex min-h-tap items-center gap-3 rounded-mu-lg border border-mu-line bg-mu-warn-soft px-4 py-3"
        >
          <Inbox className="h-5 w-5 shrink-0 text-mu-warn" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 text-mu-body text-mu-fg">
            확인할 알림·제안{" "}
            <span className="mu-num font-bold">{inboxCount}건</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-mu-fg-3" strokeWidth={1.75} aria-hidden />
        </Link>
      ) : null}

      {cancelNotice ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-mu-lg border border-mu-line bg-mu-warn-soft px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-mu-label text-mu-warn">취소 문자예요</p>
            <p className="mt-0.5 text-mu-body text-mu-fg">
              {cancelNotice.merchant ?? "가맹점"} ·{" "}
              <span className="mu-num">
                {cancelNotice.amount} {cancelNotice.currency}
              </span>
            </p>
            <p className="mt-0.5 text-mu-caption text-mu-fg-3">
              새 지출로 저장하지 않았어요.
            </p>
          </div>
          <button
            type="button"
            aria-label="취소 문자 안내 닫기"
            onClick={onDismissCancel}
            className="mu-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-mu-md text-mu-fg-2"
          >
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      ) : null}

      <section aria-labelledby="record-list-title" className="rounded-mu-lg border border-mu-line bg-mu-card px-4">
        <div className="flex items-baseline justify-between gap-2 pt-4">
          <h2 id="record-list-title" className="text-mu-heading text-mu-fg">
            최근 지출
          </h2>
          {recent.length > 0 ? (
            <span className="text-mu-caption text-mu-fg-3">누르면 분담을 바꿔요</span>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="아직 기록이 없어요"
            body="영수증을 찍거나 카드 문자를 붙여 넣으면 여기에 쌓여요."
            action={
              <Button onClick={() => onOpenAdd("receipt")}>
                <Receipt className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                영수증 올리기
              </Button>
            }
          />
        ) : (
          <div className="pb-1">
            {recent.map((e) => (
              <ExpenseRow
                key={e.id}
                merchant={e.merchantKo || e.merchant || e.label || "지출"}
                amount={Number.isFinite(e.krwAmount) ? e.krwAmount : 0}
                meta={expenseMeta(e, nameOf(e.paidBy))}
                icon={<Receipt className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
                onClick={onAdjust}
              />
            ))}
          </div>
        )}
      </section>

      {expenses.length > 0 ? (
        <details className="group rounded-mu-lg border border-mu-line bg-mu-card px-4">
          <summary className="mu-focus flex min-h-tap cursor-pointer list-none items-center gap-2 py-3 text-mu-label text-mu-fg-2">
            <ChartColumn className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            지출 분석 보기
          </summary>
          <div className="pb-4">{dashboard}</div>
        </details>
      ) : null}

      <Link
        href={`/trips/${tripId}/ledger/report`}
        className="mu-focus inline-flex min-h-tap items-center self-start text-mu-label text-mu-accent"
      >
        리포트 보기
      </Link>

      <BottomCTA
        label="지출 추가"
        onClick={() => onOpenAdd("paste")}
        secondary={{ label: "다음: 분담 조정", onClick: onAdjust }}
      />
    </div>
  );
}
