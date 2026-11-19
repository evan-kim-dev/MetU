"use client";

import Link from "next/link";
import {
  ChartColumn,
  ChevronRight,
  ClipboardPaste,
  FileText,
  Mic,
  Receipt,
  Scale,
  Sparkles,
  X,
} from "lucide-react";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { Button } from "@/components/ds/Button";
import { EmptyState } from "@/components/ds/EmptyState";
import { ExpenseRow } from "@/components/ds/ExpenseRow";
import { CashPocketCard } from "@/components/ledger/CashPocketCard";
import { OpenBudgetSuggestionCard } from "@/components/ledger/OpenBudgetSuggestionCard";
import type { AddExpenseTab } from "@/components/ledger/journey/host/AddExpenseSheet";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import type { OpenBudgetSuggestion } from "@/lib/ledger/open-suggestions";
import {
  isTravelBigTicket,
  matchExpenseToPlan,
  type PlanAlloc,
} from "@/lib/ledger/plan-match";
import { deriveTodayBudget } from "@/lib/ledger/today-budget";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import { cn } from "@/lib/design/tokens";

type Props = {
  tripId: string;
  expenses: LedgerExpenseRow[];
  members: TripMember[];
  /** 확인할 자동 수집 알림 + 대기 중인 게스트 제안 */
  inboxCount: number;
  /** open rebalance·settle Suggestion (Today 카드) */
  openSuggestions?: OpenBudgetSuggestion[];
  onSuggestionSettled?: () => void;
  cancelNotice: ExpenseDraftInput | null;
  onDismissCancel: () => void;
  onOpenAdd: (tab: AddExpenseTab) => void;
  /** 주 CTA: 의도 선택 시트 (일정·분담·현금·봇 포함) */
  onOpenIntent: () => void;
  /** 지출을 누르면 분담(선택) 단계로 가요. */
  onAdjust: () => void;
  /** 주 흐름: 기록 → 정산. */
  onSettle: () => void;
  /** 통계 카드 (LedgerDashboard) */
  dashboard: React.ReactNode;
  /** 플랜 예산 배분 — 항공·숙소 매칭 안내 (예상≠실제) */
  planAllocation?: ReadonlyArray<PlanAlloc>;
  /** 총 예산(표시용 일 한도 계산) */
  tripBudgetKrw?: number;
  /** 여행 일수(없으면 1) */
  tripDays?: number;
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

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 호스트 ③ 기록 단계: Today 히어로 · 에이전트 1건 · 오늘 지출. */
export function RecordStep({
  tripId,
  expenses,
  members,
  inboxCount,
  openSuggestions = [],
  onSuggestionSettled,
  cancelNotice,
  onDismissCancel,
  onOpenAdd,
  onOpenIntent,
  onAdjust,
  onSettle,
  dashboard,
  planAllocation = [],
  tripBudgetKrw = 0,
  tripDays = 1,
}: Props) {
  const today = todayIsoLocal();
  const todayView = deriveTodayBudget({
    totalBudgetKrw: tripBudgetKrw,
    tripDays,
    expenses,
    todayIso: today,
  });
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName;
  const todayExpenses = sortRecent(
    expenses.filter((e) => e.spentOn === today)
  );

  function planHint(e: LedgerExpenseRow): {
    status: "review";
    statusLabel: string;
  } | null {
    const label = e.merchantKo || e.merchant || e.label || "";
    if (!isTravelBigTicket(e.category, label)) return null;
    const match = matchExpenseToPlan({
      category: e.category,
      label,
      merchant: e.merchant,
      krwAmount: e.krwAmount,
      allocation: planAllocation,
    });
    if (!match) {
      return {
        status: "review",
        statusLabel: "항공·숙소 · 플랜과 따로 확인",
      };
    }
    const delta = match.deltaKrw;
    const deltaLabel =
      delta === 0
        ? "플랜과 같아요"
        : delta > 0
          ? `플랜보다 ${formatKRW(delta)} 더`
          : `플랜보다 ${formatKRW(-delta)} 덜`;
    return {
      status: "review",
      statusLabel: `${match.allocLabel} 예상 ${formatKRW(match.planAmountKrw)} · ${deltaLabel}`,
    };
  }

  const remainingPositive = todayView.remainingKrw >= 0;

  return (
    <div className="flex flex-col gap-5 pb-24">
      <section
        className={cn(
          "rounded-mu-xl border px-5 py-5",
          remainingPositive
            ? "border-mu-ok/25 bg-mu-ok-soft"
            : "border-mu-err/25 bg-mu-err-soft"
        )}
        aria-label={`오늘 쓸 수 있는 돈 ${formatKRW(Math.max(0, todayView.remainingKrw))}`}
      >
        <p className="text-mu-caption font-medium text-mu-fg-2">
          오늘 쓸 수 있는 돈
        </p>
        <p className="mu-num mt-1 text-3xl font-bold tracking-tight text-mu-fg">
          {formatKRW(Math.max(0, todayView.remainingKrw))}
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-mu-card/80">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-mu-base",
              remainingPositive ? "bg-mu-ok" : "bg-mu-err"
            )}
            style={{
              width: `${Math.round(Math.min(1, todayView.usedRatio) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-2 text-mu-caption text-mu-fg-3">
          일 예산 {formatKRW(todayView.dayBudgetKrw)} · 오늘{" "}
          {formatKRW(todayView.spentTodayKrw)} 씀
          {tripBudgetKrw <= 0 ? " · 총예산 미설정" : ""}
        </p>
      </section>

      <CashPocketCard expenses={expenses} />

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

      {openSuggestions.map((s) => (
        <OpenBudgetSuggestionCard
          key={s.id}
          tripId={tripId}
          suggestion={s}
          onSettled={() => onSuggestionSettled?.()}
          onGoSettle={s.type === "settle" ? onSettle : undefined}
        />
      ))}

      {inboxCount > 0 ? (
        <section className="overflow-hidden rounded-mu-xl border border-mu-line bg-mu-card">
          <div className="flex items-start gap-3 px-4 pt-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mu-accent-soft text-mu-accent">
              <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-mu-label font-bold text-mu-fg">에이전트 제안</p>
              <p className="mt-0.5 text-mu-body text-mu-fg-2">
                확인할 항목이{" "}
                <span className="mu-num font-semibold">{inboxCount}건</span>{" "}
                있어요. 확인 후에만 장부에 반영돼요.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 border-t border-mu-line px-4 py-3">
            <Link
              href={`/trips/${tripId}/ledger/inbox`}
              className="mu-focus flex min-h-tap flex-1 items-center justify-center rounded-mu-md bg-mu-accent text-mu-label font-semibold text-mu-on-accent"
            >
              확인
            </Link>
            <Link
              href={`/trips/${tripId}/ledger/inbox`}
              className="mu-focus flex min-h-tap flex-1 items-center justify-center rounded-mu-md border border-mu-line text-mu-label font-semibold text-mu-fg"
            >
              수정
            </Link>
          </div>
          {inboxCount > 1 ? (
            <Link
              href={`/trips/${tripId}/ledger/inbox`}
              className="mu-focus flex min-h-tap items-center justify-between border-t border-mu-line px-4 py-3 text-mu-body text-mu-accent"
            >
              <span>제안 {inboxCount - 1}개 더 보기</span>
              <ChevronRight className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </Link>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        onClick={onSettle}
        aria-label="정산으로 이동"
        className="mu-focus flex min-h-tap w-full items-center gap-3 rounded-mu-xl border border-mu-line bg-mu-card px-4 py-3 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mu-sunken text-mu-fg-2">
          <Scale className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-mu-body font-semibold text-mu-fg">정산</span>
          <span className="mt-0.5 block text-mu-caption text-mu-fg-3">
            누가 얼마를 받을지 정리해요
          </span>
        </span>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-mu-fg-3"
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

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
            오늘 지출
          </h2>
          {todayExpenses.length > 0 ? (
            <button
              type="button"
              onClick={onAdjust}
              className="mu-focus min-h-11 text-mu-caption font-bold text-mu-accent"
            >
              분담 조정
            </button>
          ) : null}
        </div>
        {todayExpenses.length === 0 ? (
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
            {todayExpenses.map((e) => {
              const hint = planHint(e);
              return (
                <ExpenseRow
                  key={e.id}
                  merchant={e.merchantKo || e.merchant || e.label || "지출"}
                  amount={Number.isFinite(e.krwAmount) ? e.krwAmount : 0}
                  meta={expenseMeta(e, nameOf(e.paidBy))}
                  status={hint?.status ?? null}
                  statusLabel={hint?.statusLabel}
                  icon={
                    <Receipt
                      className="h-5 w-5"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  }
                  onClick={onAdjust}
                />
              );
            })}
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
        label="추가"
        onClick={onOpenIntent}
        secondary={{ label: "다음: 정산하기", onClick: onSettle }}
      />
    </div>
  );
}
