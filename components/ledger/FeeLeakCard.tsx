"use client";

import {
  FEE_LEAK_EMPTY_COPY,
  computeFeeLeak,
  feeLeakMeasuredCopy,
  feeLeakMoreSpentCopy,
} from "@/lib/ledger/fee-leak";
import type { LedgerExpenseRow } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";

/**
 * 시장환율 대비 차이(측정) / 설정 추정 / DCC 확정을 분리해 보여 줘요.
 * 측정 건이 없으면 ₩0 단정 문구를 쓰지 않아요.
 */
export function FeeLeakCard({ expenses }: { expenses: LedgerExpenseRow[] }) {
  const leak = computeFeeLeak(expenses);
  const more =
    leak.measuredKrw != null ? feeLeakMoreSpentCopy(leak.measuredKrw) : null;

  return (
    <section
      aria-label="시장환율 대비 차이"
      className="rounded-2xl bg-surface-soft px-4 py-3 text-sm text-ink-body"
    >
      <h2 className="text-sm font-extrabold text-ink-heading">
        시장환율 대비 차이
      </h2>
      {leak.measuredKrw == null ? (
        <p className="mt-1 text-xs text-ink-caption">{FEE_LEAK_EMPTY_COPY}</p>
      ) : (
        <>
          {more ? (
            <p className="mt-1 text-sm font-bold text-ink-heading">{more}</p>
          ) : null}
          <p className="mt-1 text-xs text-ink-caption">
            {feeLeakMeasuredCopy(leak.measuredKrw, leak.measuredCount)}
          </p>
        </>
      )}
      {leak.estimatedCount > 0 ? (
        <p className="mt-2 text-xs text-ink-caption">
          설정 기반 추정 {leak.estimatedCount}건 ·{" "}
          {formatKRW(leak.estimatedKrw)} (카드 수수료 설정값)
        </p>
      ) : null}
      {leak.dccCount > 0 ? (
        <p className="mt-1 text-xs text-ink-caption">
          DCC 확정 {leak.dccCount}건 · 알려진 차이{" "}
          {formatKRW(leak.dccKnownKrw)} (측정 합계와 따로 봐요)
        </p>
      ) : null}
    </section>
  );
}
