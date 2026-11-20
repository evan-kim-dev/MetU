"use client";

import {
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
type Props = {
  expenses: LedgerExpenseRow[];
  /** 통합 카드 안이면 border/배경 없이 푸터처럼 */
  embedded?: boolean;
};

/**
 * 측정·추정·DCC 중 하나라도 있을 때만 그려요. 빈 상태 카드는 만들지 않아요.
 */
export function FeeLeakCard({ expenses, embedded = false }: Props) {
  const leak = computeFeeLeak(expenses);
  const hasContent =
    leak.measuredKrw != null ||
    leak.estimatedCount > 0 ||
    leak.dccCount > 0;
  if (!hasContent) return null;

  const more =
    leak.measuredKrw != null ? feeLeakMoreSpentCopy(leak.measuredKrw) : null;

  return (
    <section
      aria-label="시장환율 대비 차이"
      className={
        embedded
          ? "border-t border-mu-line px-4 py-3 text-mu-body text-mu-fg-2"
          : "rounded-mu-xl border border-mu-line bg-mu-card px-4 py-4 text-mu-body text-mu-fg-2"
      }
    >
      <h2 className="text-mu-label font-bold text-mu-fg">시장환율 대비 차이</h2>
      {leak.measuredKrw != null ? (
        <>
          {more ? (
            <p className="mt-1 text-mu-body font-bold text-mu-fg">{more}</p>
          ) : null}
          <p className="mt-1 text-mu-caption text-mu-fg-3">
            {feeLeakMeasuredCopy(leak.measuredKrw, leak.measuredCount)}
          </p>
        </>
      ) : null}
      {leak.estimatedCount > 0 ? (
        <p className="mt-2 text-mu-caption text-mu-fg-3">
          설정 기반 추정 {leak.estimatedCount}건 ·{" "}
          <span className="mu-num">{formatKRW(leak.estimatedKrw)}</span> (카드
          수수료 설정값)
        </p>
      ) : null}
      {leak.dccCount > 0 ? (
        <p className="mt-1 text-mu-caption text-mu-fg-3">
          DCC 확정 {leak.dccCount}건 · 알려진 차이{" "}
          <span className="mu-num">{formatKRW(leak.dccKnownKrw)}</span> (측정
          합계와 따로 봐요)
        </p>
      ) : null}
    </section>
  );
}
