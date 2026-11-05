"use client";

import Link from "next/link";
import {
  ChartColumn,
  ChevronRight,
  ClipboardPaste,
  FileText,
  Inbox,
  Mic,
  Receipt,
  X,
} from "lucide-react";
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
  /** 지출을 누르면 분담(선택) 단계로 가요. */
  onAdjust: () => void;
  /** 주 흐름: 기록 → 정산. */
  onSettle: () => void;
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

const QUICK_ACTIONS: Array<{
  tab: AddExpenseTab;
  label: string;
  icon: typeof Receipt;
}> = [
  { tab: "receipt", label: "영수증", icon: Receipt },
  { tab: "paste", label: "붙여넣기", icon: ClipboardPaste },
  { tab: "voice", label: "음성", icon: Mic },
];

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
  onSettle,
  dashboard,
}: Props) {
  const total = expenses.reduce(
    (s, e) => s + (Number.isFinite(e.krwAmount) ? e.krwAmount : 0),
    0
  );
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName;
  const recent = sortRecent(expenses);

  return (
    <div className="flex flex-col gap-5 pb-24">
      <AmountCard
        label="총지출"
        amount={total}
        sub={
          expenses.length > 0
            ? `지출 ${expenses.length}건 · 누르면 분담을 바꿔요`
            : "아직 기록이 없어요"
        }
        tone={expenses.length > 0 ? "accent" : "neutral"}
      />

      <div
        className="grid grid-cols-3 gap-2"
        role="group"
        aria-label="지출 추가 방법"
      >
        {QUICK_ACTIONS.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            type="button"
            onClick={() => onOpenAdd(tab)}
            className="mu-focus flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-mu-lg border border-mu-line bg-mu-card px-2 py-3 text-mu-caption font-bold text-mu-fg transition-colors active:bg-mu-sunken"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mu-accent-soft text-mu-accent">
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            {label}
          </button>
        ))}
      </div>

      {inboxCount > 0 ? (
        <Link
          href={`/trips/${tripId}/ledger/inbox`}
          className="mu-focus flex min-h-tap items-center gap-3 rounded-mu-lg border border-mu-line bg-mu-warn-soft px-4 py-3"
        >
          <Inbox
            className="h-5 w-5 shrink-0 text-mu-warn"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="min-w-0 flex-1 text-mu-body text-mu-fg">
            확인할 알림·제안{" "}
            <span className="mu-num font-bold">{inboxCount}건</span>
          </span>
          <ChevronRight
            className="h-5 w-5 shrink-0 text-mu-fg-3"
            strokeWidth={1.75}
            aria-hidden
          />
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

      <section
        aria-labelledby="record-list-title"
        className="overflow-hidden rounded-mu-xl border border-mu-line bg-mu-card"
      >
        <div className="flex items-baseline justify-between gap-2 border-b border-mu-line px-4 pt-4 pb-3">
          <h2 id="record-list-title" className="text-mu-heading text-mu-fg">
            최근 지출
          </h2>
          {recent.length > 0 ? (
            <button
              type="button"
              onClick={onAdjust}
              className="mu-focus min-h-11 text-mu-caption font-bold text-mu-accent"
            >
              분담 조정
            </button>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <div className="px-2">
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
          </div>
        ) : (
          <div className="px-4 pb-1">
            {recent.map((e) => (
              <ExpenseRow
                key={e.id}
                merchant={e.merchantKo || e.merchant || e.label || "지출"}
                amount={Number.isFinite(e.krwAmount) ? e.krwAmount : 0}
                meta={expenseMeta(e, nameOf(e.paidBy))}
                icon={
                  <Receipt className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                }
                onClick={onAdjust}
              />
            ))}
          </div>
        )}
      </section>

      {expenses.length > 0 ? (
        <details className="group overflow-hidden rounded-mu-xl border border-mu-line bg-mu-card">
          <summary className="mu-focus flex min-h-tap cursor-pointer list-none items-center gap-2 px-4 py-3 text-mu-label text-mu-fg">
            <ChartColumn
              className="h-5 w-5 text-mu-accent"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="flex-1 font-bold">지출 분석 보기</span>
            <ChevronRight
              className="h-5 w-5 text-mu-fg-3 transition-transform group-open:rotate-90"
              strokeWidth={1.75}
              aria-hidden
            />
          </summary>
          <div className="border-t border-mu-line px-4 py-4">{dashboard}</div>
        </details>
      ) : null}

      <Link
        href={`/trips/${tripId}/ledger/report`}
        className="mu-focus flex min-h-tap items-center gap-3 rounded-mu-xl border border-mu-line bg-mu-card px-4 py-3"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mu-sunken text-mu-fg-2">
          <FileText className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-mu-body font-semibold text-mu-fg">
            리포트
          </span>
          <span className="mt-0.5 block text-mu-caption text-mu-fg-3">
            여행 지출을 한눈에 정리해요
          </span>
        </span>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-mu-fg-3"
          strokeWidth={1.75}
          aria-hidden
        />
      </Link>

      <BottomCTA
        label="지출 추가"
        onClick={() => onOpenAdd("paste")}
        secondary={{ label: "다음: 정산하기", onClick: onSettle }}
      />
    </div>
  );
}
