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
      className={className ?? "rounded-mu-lg bg-mu-sunken px-4 py-3"}
      data-testid="currency-totals"
    >
      <p className="text-mu-label text-mu-fg">통화별 지출</p>
      <ul className="mt-2 flex flex-col gap-2">
        {totals.map((t) => (
          <li
            key={t.currency}
            className="flex items-baseline justify-between gap-2 text-mu-body text-mu-fg-2"
            aria-label={`${t.currency} ${t.count}건, ${formatOriginalAmount(
              t.amount,
              t.currency
            )}, 원화로 ${formatKRW(t.krw)}`}
          >
            <span>
              {formatOriginalAmount(t.amount, t.currency)}
              <span className="text-mu-caption text-mu-fg-3"> · {t.count}건</span>
            </span>
            <span className="mu-num font-bold text-mu-fg">
              {formatKRW(t.krw)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-mu-line pt-3 text-mu-body">
        <span className="font-bold text-mu-fg">원화 합계</span>
        <span className="mu-num font-extrabold text-mu-fg">
          {formatKRW(totalKrw)}
        </span>
      </div>
    </div>
  );
}
