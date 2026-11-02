import type { LedgerExpenseRow } from "@/lib/ledger/types";

export type FeeLeakResult = {
  /** billedKrw − krwBase 합계. 측정 건 0이면 null (숫자 만들지 않음). */
  measuredKrw: number | null;
  measuredCount: number;
  /** billed 없고 feeKrw>0 인 건의 feeKrw 합 (설정 기반 추정). */
  estimatedKrw: number;
  estimatedCount: number;
  /** DCC confirmed markupKrw 합 (measured와 합치지 않음). */
  dccKnownKrw: number;
  dccCount: number;
};

type ExpenseExtras = {
  billedKrw?: number | null;
  status?: string;
  flags?: {
    dcc?: {
      level?: string;
      markupKrw?: number | null;
    };
  } | null;
};

function asExtras(e: LedgerExpenseRow): ExpenseExtras {
  return e as LedgerExpenseRow & ExpenseExtras;
}

function isVoided(e: LedgerExpenseRow): boolean {
  return asExtras(e).status === "voided";
}

/**
 * 여행 지출에서 시장환율 대비 차이·설정 추정·DCC 확정을 분리 합산.
 * 측정 건이 없으면 measuredKrw=null (₩0 단정 금지).
 */
export function computeFeeLeak(expenses: LedgerExpenseRow[]): FeeLeakResult {
  let measuredKrw = 0;
  let measuredCount = 0;
  let estimatedKrw = 0;
  let estimatedCount = 0;
  let dccKnownKrw = 0;
  let dccCount = 0;

  for (const e of expenses) {
    if (isVoided(e)) continue;
    const extra = asExtras(e);

    const billed =
      typeof extra.billedKrw === "number" && Number.isFinite(extra.billedKrw)
        ? Math.round(extra.billedKrw)
        : null;
    const krwBase =
      typeof e.krwBase === "number" && Number.isFinite(e.krwBase)
        ? Math.round(e.krwBase)
        : null;
    const feeKrw =
      typeof e.feeKrw === "number" && Number.isFinite(e.feeKrw)
        ? Math.round(e.feeKrw)
        : 0;

    if (billed != null && krwBase != null) {
      measuredKrw += billed - krwBase;
      measuredCount += 1;
    } else if (billed == null && feeKrw > 0) {
      estimatedKrw += feeKrw;
      estimatedCount += 1;
    }

    const dcc = extra.flags?.dcc;
    if (
      dcc?.level === "confirmed" &&
      typeof dcc.markupKrw === "number" &&
      Number.isFinite(dcc.markupKrw)
    ) {
      dccKnownKrw += Math.round(dcc.markupKrw);
      dccCount += 1;
    }
  }

  return {
    measuredKrw: measuredCount === 0 ? null : measuredKrw,
    measuredCount,
    estimatedKrw,
    estimatedCount,
    dccKnownKrw,
    dccCount,
  };
}

export const FEE_LEAK_EMPTY_COPY =
  "아직 측정된 건이 없어요(실제 청구액이 연결되면 계산돼요)";

export function feeLeakMeasuredCopy(
  measuredKrw: number,
  measuredCount: number
): string {
  const abs = Math.abs(measuredKrw).toLocaleString("ko-KR");
  const sign = measuredKrw > 0 ? "" : measuredKrw < 0 ? "-" : "";
  return `시장환율(일별) 대비 차이 합계 ₩${sign}${abs} — 수수료·환율 시점 차 포함, 측정된 ${measuredCount}건 기준`;
}

export function feeLeakMoreSpentCopy(measuredKrw: number): string | null {
  if (measuredKrw <= 0) return null;
  return `이번 여행에서 ₩${measuredKrw.toLocaleString("ko-KR")} 더 나갔어요`;
}
