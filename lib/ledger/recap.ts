import { computeFeeLeak } from "@/lib/ledger/fee-leak";
import { byCategory, byDay, totalKrw } from "@/lib/ledger/stats";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";

export type TripRecap = {
  totalKrw: number;
  perMemberOwed: Array<{ memberId: string; name: string; krw: number }>;
  topDay?: { date: string; krw: number };
  topCategory?: { category: string; krw: number };
  recordCounts?: Partial<Record<string, number>>;
  feeLeak?: { measuredKrw: number; measuredCount: number };
  dccSuspectedCount?: number;
};

/**
 * 발표용 한 장 리캡. 없는 데이터는 키를 생략한다(null 채우지 않음).
 */
export function buildTripRecap(input: {
  members: TripMember[];
  expenses: LedgerExpenseRow[];
}): TripRecap {
  const expenses = input.expenses.filter(
    (e) => (e as { status?: string }).status !== "voided"
  );
  const total = totalKrw(expenses);
  const nameOf = (id: string) =>
    input.members.find((m) => m.id === id)?.displayName ?? id;

  const owed: Record<string, number> = {};
  for (const e of expenses) {
    for (const [mid, share] of Object.entries(e.shares ?? {})) {
      owed[mid] = (owed[mid] ?? 0) + share;
    }
  }
  const perMemberOwed = Object.entries(owed)
    .map(([memberId, krw]) => ({
      memberId,
      name: nameOf(memberId),
      krw,
    }))
    .sort((a, b) => b.krw - a.krw || a.memberId.localeCompare(b.memberId));

  const recap: TripRecap = {
    totalKrw: total,
    perMemberOwed,
  };

  if (expenses.length === 0) return recap;

  const days = byDay(expenses);
  const dayEntries = Object.entries(days)
    .filter(([d]) => d !== "unknown")
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (dayEntries[0]) {
    recap.topDay = { date: dayEntries[0][0], krw: dayEntries[0][1] };
  }

  const cats = byCategory(expenses);
  const catEntries = Object.entries(cats).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  if (catEntries[0]) {
    recap.topCategory = {
      category: catEntries[0][0],
      krw: catEntries[0][1],
    };
  }

  const counts: Record<string, number> = {};
  for (const e of expenses) {
    const src = e.source ?? "manual";
    counts[src] = (counts[src] ?? 0) + 1;
  }
  if (Object.keys(counts).length > 0) {
    recap.recordCounts = counts;
  }

  const leak = computeFeeLeak(expenses);
  if (leak.measuredCount > 0 && leak.measuredKrw != null) {
    recap.feeLeak = {
      measuredKrw: leak.measuredKrw,
      measuredCount: leak.measuredCount,
    };
  }

  let dccSuspected = 0;
  for (const e of expenses) {
    if (e.flags?.dcc?.level === "suspected") dccSuspected += 1;
  }
  if (dccSuspected > 0) {
    recap.dccSuspectedCount = dccSuspected;
  }

  return recap;
}

/** AI 요약 숫자 가드: 출력의 모든 숫자 토큰이 입력 수치 집합에 있어야 한다. */
export function assertRecapCopyNumbers(
  copy: string,
  allowedNumbers: readonly number[]
): boolean {
  const allowed = new Set(
    allowedNumbers.map((n) => String(Math.round(n))).concat(
      allowedNumbers.map((n) => String(n))
    )
  );
  const tokens = copy.match(/\d+(?:[.,]\d+)?%?/g) ?? [];
  for (const raw of tokens) {
    const cleaned = raw.replace(/%$/, "").replace(/,/g, "");
    if (!allowed.has(cleaned) && !allowed.has(String(Math.round(Number(cleaned))))) {
      return false;
    }
  }
  return true;
}

export function templateRecapCopy(recap: TripRecap): string {
  const parts = [`이번 여행 총 ${recap.totalKrw.toLocaleString("ko-KR")}원`];
  if (recap.topCategory) {
    parts.push(
      `가장 많이 쓴 카테고리는 ${recap.topCategory.category}예요`
    );
  }
  return `${parts.join(". ")}.`;
}
