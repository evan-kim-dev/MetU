"use client";

import { ChevronDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { CurrencyTotals } from "@/components/ledger/CurrencyTotals";
import { SkeletonBlock } from "@/components/ui/PageSkeleton";
import { formatOriginalAmount } from "@/lib/ledger/fx-display";
import { totalKrw, totalsByCurrency } from "@/lib/ledger/stats";
import type { LedgerExpenseRow } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import type { Trip } from "@/lib/trips/types";
import {
  AutomationPill,
  type AutomationPillState,
} from "./AutomationPill";
import { SectionRetry } from "./SectionRetry";
import type { SectionState } from "./useLedgerHomeData";

type Props = {
  trip: Trip;
  expenses: SectionState<LedgerExpenseRow[]>;
  onRetryExpenses: () => void;
  /** null 이면 알약을 숨겨요 (게스트·로딩·에러) */
  pill: AutomationPillState | null;
  canSwitch: boolean;
  onSwitch: () => void;
  /** 시트가 닫힐 때 포커스를 돌려받는 버튼 ref */
  switchRef?: React.Ref<HTMLButtonElement>;
};

export function TripHeaderCard({
  trip,
  expenses,
  onRetryExpenses,
  pill,
  canSwitch,
  onSwitch,
  switchRef,
}: Props) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const rows = expenses.data;
  const totals = useMemo(() => (rows ? totalsByCurrency(rows) : []), [rows]);
  const foreign = totals.filter((t) => t.currency !== "KRW");
  const foreignLine = foreign
    .map((t) => formatOriginalAmount(t.amount, t.currency))
    .join(" · ");

  return (
    <section
      aria-label="여행 지출 현황"
      className="flex flex-col gap-3 rounded-2xl bg-surface-white p-4 shadow-soft ring-1 ring-line-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold text-ink-heading">
            {trip.destination}
          </h2>
          <p className="truncate text-xs text-ink-caption">
            {trip.dateRange}
            {trip.isOwner === false ? " · 공유받은 여행" : ""}
          </p>
        </div>
        {canSwitch ? (
          <button
            ref={switchRef}
            type="button"
            onClick={onSwitch}
            className="inline-flex min-h-tap shrink-0 items-center gap-1 rounded-full bg-surface-soft px-3 text-xs font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            여행 바꾸기
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-ink-caption">총지출</p>
        {expenses.status === "loading" ? (
          <SkeletonBlock className="h-8 w-40 rounded-xl" />
        ) : expenses.status === "error" || !rows ? (
          <SectionRetry onRetry={onRetryExpenses} />
        ) : (
          <>
            <p
              data-testid="trip-total-krw"
              className="text-2xl font-extrabold tabular-nums text-ink-heading"
            >
              {formatKRW(totalKrw(rows))}
            </p>
            {foreign.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-expanded={open}
                  aria-controls={detailId}
                  className="flex min-h-tap w-full items-center gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="min-w-0 flex-1 truncate text-xs tabular-nums text-ink-body">
                    {foreignLine}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={`h-4 w-4 shrink-0 text-ink-caption ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div id={detailId} hidden={!open}>
                  <CurrencyTotals totals={totals} totalKrw={totalKrw(rows)} />
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      {pill ? <AutomationPill state={pill} /> : null}
    </section>
  );
}
