"use client";

import { useMemo, useState } from "react";
import { CurrencyTotals } from "@/components/ledger/CurrencyTotals";
import { BudgetDonutChart } from "@/components/recommend/BudgetDonutChart";
import type { BudgetAllocation } from "@/lib/ai/types";
import {
  computeLedgerStats,
  type LedgerStatsInput,
} from "@/lib/ledger/stats";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { MU_COLORS, cn } from "@/lib/design/tokens";
import { formatKRW } from "@/lib/shared/format";

/** 차트 시리즈 — hex 리터럴 금지(래칫). 토큰 값만 참조. */
const DONUT_COLORS = [
  MU_COLORS.accent,
  MU_COLORS.warn,
  MU_COLORS.ok,
  MU_COLORS.accentStrong,
  MU_COLORS.err,
  MU_COLORS.fg3,
];

type Props = {
  expenses: LedgerExpenseRow[];
  members: TripMember[];
  budget: number;
  startDate?: string | null;
  endDate?: string | null;
  onRefreshInsight?: () => void;
  insight?: {
    headline: string;
    bullets: string[];
    saving_tips: string[];
    warnings: string[];
  } | null;
  insightLoading?: boolean;
  /** details 안 등 바깥 카드가 있을 때 이중 카드 방지 */
  embedded?: boolean;
};

export function LedgerDashboard({
  expenses,
  members,
  budget,
  startDate,
  endDate,
  onRefreshInsight,
  insight,
  insightLoading,
  embedded = false,
}: Props) {
  const [scope, setScope] = useState<"all" | "today">("all");
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(
    () =>
      scope === "today"
        ? expenses.filter((e) => e.spentOn === today)
        : expenses,
    [expenses, scope, today]
  );

  const stats = useMemo(() => {
    const input: LedgerStatsInput = {
      expenses: filtered,
      budget,
      startDate,
      endDate,
      today,
    };
    return computeLedgerStats(input);
  }, [filtered, budget, startDate, endDate, today]);

  const dayEntries = Object.entries(stats.byDay).sort(([a], [b]) =>
    a < b ? -1 : 1
  );
  const maxDay = Math.max(1, ...dayEntries.map(([, v]) => v));

  const catTotal = Math.max(1, stats.totalKrw);
  const donutItems: BudgetAllocation[] = Object.entries(stats.byCategory).map(
    ([label, amount], i) => ({
      id: label,
      label,
      amount,
      percent: Math.round((amount / catTotal) * 1000) / 10,
      color: DONUT_COLORS[i % DONUT_COLORS.length]!,
    })
  );

  if (expenses.length === 0) {
    return (
      <div
        className={cn(
          "px-1 py-4 text-center text-mu-body text-mu-fg-3",
          !embedded &&
            "rounded-mu-xl border border-mu-line bg-mu-sunken px-4 py-6"
        )}
      >
        지출을 추가하면 예산 대비 현황이 여기에 보여요.
      </div>
    );
  }

  const usedPct = Math.min(
    100,
    Math.round((stats.totalKrw / Math.max(budget, 1)) * 100)
  );

  return (
    <section
      className={cn(
        "flex flex-col gap-5",
        !embedded && "rounded-mu-xl border border-mu-line bg-mu-card p-5"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-mu-heading text-mu-fg">예산 현황</h2>
        <div
          className="flex rounded-mu-md bg-mu-sunken p-1"
          role="group"
          aria-label="기간"
        >
          {(["all", "today"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                "mu-focus min-h-tap rounded-mu-sm px-3 text-mu-caption font-bold transition-colors",
                scope === s
                  ? "bg-mu-card text-mu-fg"
                  : "text-mu-fg-3"
              )}
              onClick={() => setScope(s)}
            >
              {s === "all" ? "전체" : "오늘"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-mu-lg bg-mu-sunken p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-mu-caption text-mu-fg-3">쓴 금액</p>
            <p className="mu-num mt-1 text-mu-amount font-extrabold text-mu-fg">
              {formatKRW(stats.totalKrw)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-mu-caption text-mu-fg-3">예산</p>
            <p className="mu-num mt-1 text-mu-body font-bold text-mu-fg-2">
              {formatKRW(budget)}
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-mu-card">
          <div
            className="h-full rounded-full bg-mu-accent transition-[width] duration-mu-base"
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <p className="mt-3 text-mu-caption leading-relaxed text-mu-fg-2">
          남은 예산{" "}
          <span className="mu-num font-bold text-mu-fg">
            {formatKRW(stats.remainingBudget)}
          </span>
          {stats.dailyRecommended != null
            ? ` · 하루 권장 ${formatKRW(stats.dailyRecommended)}`
            : ""}
        </p>
        <p className="mt-1 text-mu-caption text-mu-fg-3">
          일자별 중앙값 환율 기준 근사치예요. 실제 청구액과 다를 수 있어요.
        </p>
      </div>

      <CurrencyTotals
        totals={stats.totalsByCurrency}
        totalKrw={stats.totalKrw}
      />

      {dayEntries.length > 0 ? (
        <div>
          <p className="mb-3 text-mu-label text-mu-fg">일별</p>
          <div className="flex h-28 items-end gap-1.5">
            {dayEntries.map(([d, v]) => (
              <div
                key={d}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              >
                <div
                  className="w-full max-w-[2rem] rounded-t-lg bg-mu-accent"
                  style={{
                    height: `${Math.max(8, (v / maxDay) * 100)}%`,
                  }}
                  title={formatKRW(v)}
                />
                <span className="truncate text-mu-caption text-mu-fg-3">
                  {d.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {donutItems.length > 0 ? (
        <div>
          <p className="mb-3 text-mu-label text-mu-fg">카테고리</p>
          <BudgetDonutChart
            items={donutItems}
            totalBudget={Math.max(stats.totalKrw, 1)}
            people={members.length || 1}
          />
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-mu-label text-mu-fg">사람별</p>
        <ul className="divide-y divide-mu-line rounded-mu-lg border border-mu-line">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 px-3 py-3"
            >
              <span className="min-w-0 truncate text-mu-body font-semibold text-mu-fg">
                {m.displayName}
              </span>
              <span className="shrink-0 text-right text-mu-caption text-mu-fg-3">
                냄{" "}
                <span className="mu-num font-bold text-mu-fg">
                  {formatKRW(stats.byPayer[m.id] ?? 0)}
                </span>
                <span className="mx-1 text-mu-line-strong">·</span>
                몫{" "}
                <span className="mu-num font-bold text-mu-fg">
                  {formatKRW(stats.owedByMember[m.id] ?? 0)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-mu-lg bg-mu-sunken p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-mu-label text-mu-fg">요약</p>
          <button
            type="button"
            disabled={insightLoading}
            className="mu-focus min-h-11 px-2 text-mu-caption font-bold text-mu-accent disabled:opacity-50"
            onClick={() => onRefreshInsight?.()}
          >
            {insightLoading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
        {insight ? (
          <div className="mt-3 space-y-2 text-mu-body text-mu-fg-2">
            <p className="font-bold text-mu-fg">{insight.headline}</p>
            <ul className="list-disc space-y-1 pl-4">
              {insight.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {insight.saving_tips.length > 0 ? (
              <>
                <p className="pt-1 font-bold text-mu-fg">절약 팁</p>
                <ul className="list-disc space-y-1 pl-4">
                  {insight.saving_tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {insight.warnings.map((w) => (
              <p key={w} className="font-semibold text-mu-err">
                {w}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-mu-caption text-mu-fg-3">
            새로고침을 누르면 요약을 만들어요.
          </p>
        )}
      </div>
    </section>
  );
}
