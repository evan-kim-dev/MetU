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
import { MU_COLORS } from "@/lib/design/tokens";
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
      <div className="rounded-2xl bg-mu-sunken px-4 py-6 text-center text-sm text-mu-fg-3">
        지출을 추가하면 예산 대비 현황이 여기에 보여요.
      </div>
    );
  }

  const usedPct = Math.min(
    100,
    Math.round((stats.totalKrw / Math.max(budget, 1)) * 100)
  );

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-mu-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-mu-fg">예산 대시보드</h2>
        <div className="flex gap-1">
          {(["all", "today"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                scope === s ? "bg-mu-accent text-mu-on-accent" : "bg-mu-sunken"
              }`}
              onClick={() => setScope(s)}
            >
              {s === "all" ? "전체" : "오늘"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-mu-sunken p-3">
        <div className="mb-2 flex justify-between text-xs font-bold">
          <span>사용 {formatKRW(stats.totalKrw)}</span>
          <span>예산 {formatKRW(budget)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-mu-accent"
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-mu-fg-2">
          남은 예산 {formatKRW(stats.remainingBudget)}
          {stats.dailyRecommended != null
            ? ` · 하루 권장 ${formatKRW(stats.dailyRecommended)}`
            : ""}
        </p>
        <p className="mt-1 text-xs text-mu-fg-3">
          일자별 중앙값 환율 기준 근사치, 실제 청구액과 다를 수 있어요.
        </p>
      </div>

      <CurrencyTotals
        totals={stats.totalsByCurrency}
        totalKrw={stats.totalKrw}
      />

      <div>
        <p className="mb-2 text-xs font-bold text-mu-fg">일별</p>
        <div className="flex h-24 items-end gap-1">
          {dayEntries.map(([d, v]) => (
            <div key={d} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-mu-accent/80"
                style={{ height: `${(v / maxDay) * 100}%`, minHeight: 4 }}
                title={formatKRW(v)}
              />
              <span className="text-xs text-mu-fg-3">{d.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {donutItems.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold text-mu-fg">카테고리</p>
          <BudgetDonutChart
            items={donutItems}
            totalBudget={Math.max(stats.totalKrw, 1)}
            people={members.length || 1}
          />
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-bold text-mu-fg">사람별</p>
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="text-mu-fg-3">
              <th className="py-1 font-semibold">이름</th>
              <th className="py-1 font-semibold">낸 돈</th>
              <th className="py-1 font-semibold">내 부담</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-mu-line/60">
                <td className="py-1 font-semibold">{m.displayName}</td>
                <td className="py-1">{formatKRW(stats.byPayer[m.id] ?? 0)}</td>
                <td className="py-1">
                  {formatKRW(stats.owedByMember[m.id] ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl bg-mu-sunken p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-mu-fg">AI 인사이트</p>
          <button
            type="button"
            disabled={insightLoading}
            className="text-[11px] font-bold text-mu-accent disabled:opacity-50"
            onClick={() => onRefreshInsight?.()}
          >
            {insightLoading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
        {insight ? (
          <div className="mt-2 text-xs text-mu-fg-2">
            <p className="font-bold text-mu-fg">{insight.headline}</p>
            <ul className="mt-1 list-disc pl-4">
              {insight.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="mt-2 font-bold">절약 팁</p>
            <ul className="list-disc pl-4">
              {insight.saving_tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {insight.warnings.map((w) => (
              <p key={w} className="mt-1 font-semibold text-mu-err">
                {w}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-mu-fg-3">
            새로고침을 누르면 요약이 생성돼요.
          </p>
        )}
      </div>

    </section>
  );
}
