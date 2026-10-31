"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import {
  formatFxLine,
  formatOriginalAmount,
  FX_FALLBACK_LABEL,
} from "@/lib/ledger/fx-display";
import type { LedgerExpenseRow } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";

/**
 * 외화 지출 행 아래 환율 표기. 탭하면 출처·기준일·수수료·품목을 펼쳐요.
 * 표시 전용: 환율/금액을 계산하지 않고 저장된 값만 보여줘요.
 */
export function ExpenseFxLine({ expense }: { expense: LedgerExpenseRow }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const fx = formatFxLine(expense);
  if (!fx.isForeign) return null;

  const feeKrw = expense.feeKrw ?? 0;
  const items = (expense.items ?? []).filter((it) => it.name);
  const fullDate = expense.fxRateDate ?? null;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailId}
        aria-label={fx.ariaLabel}
        className="flex min-h-[44px] w-full items-center gap-2 rounded-lg text-left"
      >
        <span className="min-w-0 flex-1 text-xs text-ink-caption">
          <span className={fx.rateUnknown ? "font-semibold text-amber-800" : ""}>
            {fx.summary}
          </span>
          {fx.isFallback ? (
            <span className="ml-1.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 align-middle text-[10px] font-bold text-amber-900 ring-1 ring-amber-200">
              {FX_FALLBACK_LABEL}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-caption transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {fx.isFallback ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900 ring-1 ring-amber-200">
          실시간 환율을 못 가져와 마지막으로 확인한 환율을 썼어요. 정산하기 전에
          실제 청구액과 맞는지 확인해 주세요.
        </p>
      ) : null}

      <div id={detailId} hidden={!open}>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-surface-soft px-3 py-2 text-[11px] text-ink-body">
          <dt className="text-ink-caption">환율 출처</dt>
          <dd>{fx.sourceLabel}</dd>
          <dt className="text-ink-caption">기준일</dt>
          <dd>{fullDate ?? "미상"}</dd>
          <dt className="text-ink-caption">외화 금액</dt>
          <dd>{fx.original}</dd>
          <dt className="text-ink-caption">원화 환산</dt>
          <dd>{fx.krw}</dd>
          {feeKrw > 0 ? (
            <>
              <dt className="text-ink-caption">수수료</dt>
              <dd>{formatKRW(feeKrw)}</dd>
            </>
          ) : null}
        </dl>
        {items.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-0.5 px-1 text-[11px] text-ink-body">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  {it.nameKo || it.name}
                  {it.qty && it.qty > 1 ? ` × ${it.qty}` : ""}
                </span>
                {/* VERIFY: 품목 amount 는 영수증 통화(원 통화) 기준이라고 가정 */}
                {it.amount != null ? (
                  <span className="shrink-0">
                    {formatOriginalAmount(it.amount, expense.currency)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
