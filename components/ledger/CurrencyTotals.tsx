import type { CurrencyTotal } from "@/lib/ledger/stats";
import { formatOriginalAmount } from "@/lib/ledger/fx-display";
import { formatKRW } from "@/lib/shared/format";

interface CurrencyTotalsProps {
  totals: CurrencyTotal[];
  totalKrw: number;
  className?: string;
}

/** 통화별 합계 + 원화 총합. 외화 지출이 없으면 아무것도 그리지 않는다. */
export function CurrencyTotals({
  totals,
  totalKrw,
  className,
}: CurrencyTotalsProps) {
  const hasForeign = totals.some((t) => t.currency !== "KRW");
  if (!hasForeign) return null;

  return (
    <div
      className={className ?? "rounded-xl bg-surface-soft px-3 py-2"}
      data-testid="currency-totals"
    >
      <p className="text-xs font-bold text-ink-heading">통화별 지출</p>
      <ul className="mt-1 flex flex-col gap-1">
        {totals.map((t) => (
          <li
            key={t.currency}
            className="flex items-baseline justify-between gap-2 text-xs text-ink-body"
            aria-label={`${t.currency} ${t.count}건, ${formatOriginalAmount(
              t.amount,
              t.currency
            )}, 원화로 ${formatKRW(t.krw)}`}
          >
            <span>
              {formatOriginalAmount(t.amount, t.currency)}
              <span className="text-ink-caption"> · {t.count}건</span>
            </span>
            <span className="font-bold text-ink-heading">{formatKRW(t.krw)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex items-baseline justify-between border-t border-line-soft pt-1.5 text-xs">
        <span className="font-bold text-ink-heading">원화 합계</span>
        <span className="font-extrabold text-ink-heading">
          {formatKRW(totalKrw)}
        </span>
      </div>
    </div>
  );
}
