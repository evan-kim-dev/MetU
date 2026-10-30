import type { LedgerExpenseRow } from "@/lib/ledger/types";

export type LedgerStatsInput = {
  expenses: LedgerExpenseRow[];
  budget: number;
  startDate?: string | null;
  endDate?: string | null;
  today?: string;
};

export function totalKrw(expenses: LedgerExpenseRow[]): number {
  return expenses.reduce((s, e) => s + e.krwAmount, 0);
}

export function byDay(expenses: LedgerExpenseRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    const d = e.spentOn ?? "unknown";
    out[d] = (out[d] ?? 0) + e.krwAmount;
  }
  return out;
}

export function byCategory(expenses: LedgerExpenseRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    const c = e.category || "기타";
    out[c] = (out[c] ?? 0) + e.krwAmount;
  }
  return out;
}

function byPayer(expenses: LedgerExpenseRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    out[e.paidBy] = (out[e.paidBy] ?? 0) + e.krwAmount;
  }
  return out;
}

function owedByMember(
  expenses: LedgerExpenseRow[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    for (const [mid, share] of Object.entries(e.shares)) {
      out[mid] = (out[mid] ?? 0) + share;
    }
  }
  return out;
}

export function remainingBudget(budget: number, spent: number): number {
  return budget - spent;
}

export function dailyRecommended(p: {
  remaining: number;
  today: string;
  endDate?: string | null;
}): number | null {
  if (!p.endDate) return null;
  if (p.today > p.endDate) return null;
  const t0 = Date.parse(`${p.today}T12:00:00`);
  const t1 = Date.parse(`${p.endDate}T12:00:00`);
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null;
  const daysLeft = Math.max(1, Math.round((t1 - t0) / 86_400_000) + 1);
  if (p.remaining <= 0) return 0;
  return Math.floor(p.remaining / daysLeft);
}

function pace(p: {
  spent: number;
  budget: number;
  today: string;
  startDate?: string | null;
  endDate?: string | null;
}): number | null {
  if (!p.startDate || !p.endDate || !(p.budget > 0)) return null;
  const start = Date.parse(`${p.startDate}T12:00:00`);
  const end = Date.parse(`${p.endDate}T12:00:00`);
  const today = Date.parse(`${p.today}T12:00:00`);
  if ([start, end, today].some(Number.isNaN)) return null;
  const totalDays = Math.max(1, Math.round((end - start) / 86_400_000) + 1);
  const elapsed = Math.min(
    totalDays,
    Math.max(1, Math.round((today - start) / 86_400_000) + 1)
  );
  const expected = p.budget * (elapsed / totalDays);
  return expected > 0 ? p.spent / expected : null;
}

export function computeLedgerStats(input: LedgerStatsInput) {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const spent = totalKrw(input.expenses);
  const remaining = remainingBudget(input.budget, spent);
  return {
    totalKrw: spent,
    byDay: byDay(input.expenses),
    byCategory: byCategory(input.expenses),
    byPayer: byPayer(input.expenses),
    owedByMember: owedByMember(input.expenses),
    remainingBudget: remaining,
    dailyRecommended: dailyRecommended({
      remaining,
      today,
      endDate: input.endDate,
    }),
    pace: pace({
      spent,
      budget: input.budget,
      today,
      startDate: input.startDate,
      endDate: input.endDate,
    }),
  };
}

export function buildLocalInsight(stats: ReturnType<typeof computeLedgerStats>): {
  headline: string;
  bullets: string[];
  saving_tips: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  if (stats.remainingBudget < 0) {
    warnings.push(`예산을 ${Math.abs(stats.remainingBudget).toLocaleString("ko-KR")}원 초과했어요.`);
  }
  const topCat = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])[0];
  return {
    headline:
      stats.remainingBudget >= 0
        ? `남은 예산은 ${stats.remainingBudget.toLocaleString("ko-KR")}원이에요.`
        : "예산이 조금 빠듯해 보여요.",
    bullets: [
      `총 지출 ${stats.totalKrw.toLocaleString("ko-KR")}원`,
      topCat
        ? `${topCat[0]}이(가) ${topCat[1].toLocaleString("ko-KR")}원으로 가장 커요`
        : "아직 지출이 없어요",
      stats.dailyRecommended != null
        ? `하루 권장 약 ${stats.dailyRecommended.toLocaleString("ko-KR")}원`
        : "여행 종료일 기준 하루 권장은 없어요",
    ],
    saving_tips: [
      "현금은 환전 단가를 맞춰 두면 예측이 쉬워져요.",
      "점심은 현지 체인으로 바꿔도 분위기는 살릴 수 있어요.",
      "이동은 하루 동선으로 묶으면 교통비가 줄어요.",
    ],
    warnings,
  };
}
