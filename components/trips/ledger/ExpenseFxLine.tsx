"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import {
  formatFxLine,
  formatOriginalAmount,
  FX_FALLBACK_LABEL,
} from "@/lib/ledger/fx-display";
import {
  effectiveRate,
  formatDiffPct,
  FX_MERGE_DIFF_LABEL,
  marketDiffPct,
} from "@/lib/ledger/fx-merge";
import type { LedgerExpenseRow } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";

/**
 * 외화 지출 행 아래 환율 표기. 탭하면 출처·기준일·수수료·품목을 펼쳐요.
 * 청구액이 있으면 "₩N 청구 · 시장환율 대비 +x.x%" 를 보여요 (순수 수수료가 아님).
 * 표시 전용: 환율/금액을 계산하지 않고 저장된 값만 보여줘요. 청구 입력·되돌리기는 서버 RPC.
 */
export function ExpenseFxLine({
  expense,
  onChanged,
}: {
  expense: LedgerExpenseRow;
  /** 청구액 입력/되돌리기 후 목록 갱신 */
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [billedInput, setBilledInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detailId = useId();
  const fx = formatFxLine(expense);
  if (!fx.isForeign) return null;

  const feeKrw = expense.feeKrw ?? 0;
  const items = (expense.items ?? []).filter((it) => it.name);
  const fullDate = expense.fxRateDate ?? null;
  const billedKrw =
    typeof expense.billedKrw === "number" && expense.billedKrw > 0
      ? expense.billedKrw
      : null;
  const marketKrw =
    typeof expense.krwBase === "number" && expense.krwBase > 0
      ? expense.krwBase
      : null;
  const diffPct =
    billedKrw != null && marketKrw != null
      ? marketDiffPct(billedKrw, marketKrw)
      : null;
  const eff =
    billedKrw != null ? effectiveRate(billedKrw, expense.amount) : null;

  async function postJson(url: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          data.error === "forbidden"
            ? "권한이 없어요"
            : "저장에 실패했어요. 잠시 후 다시 시도해 주세요"
        );
        return;
      }
      setBilledInput("");
      onChanged?.();
    } catch {
      setError("네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  }

  function submitBilled() {
    const n = Math.round(Number(billedInput.replace(/[,\s]/g, "")));
    if (!Number.isFinite(n) || n <= 0) {
      setError("청구액을 숫자로 입력해 주세요");
      return;
    }
    void postJson(`/api/agent/expenses/${expense.id}/billed`, {
      billedKrw: n,
    });
  }

  function unmerge() {
    void postJson(`/api/agent/expenses/${expense.id}/unmerge`, {
      reason: "ui_unmerge",
    });
  }

  const summary =
    billedKrw != null
      ? `${formatKRW(billedKrw)} 청구${
          diffPct != null
            ? ` · ${FX_MERGE_DIFF_LABEL} ${formatDiffPct(diffPct)}`
            : ""
        }`
      : fx.summary;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailId}
        aria-label={
          billedKrw != null
            ? `청구액 ${formatKRW(billedKrw)}${
                diffPct != null
                  ? `, ${FX_MERGE_DIFF_LABEL} ${formatDiffPct(diffPct)}`
                  : ""
              }`
            : fx.ariaLabel
        }
        className="flex min-h-[44px] w-full items-center gap-2 rounded-lg text-left"
      >
        <span className="min-w-0 flex-1 text-xs text-ink-caption">
          <span className={fx.rateUnknown && !billedKrw ? "font-semibold text-amber-800" : ""}>
            {summary}
          </span>
          {fx.isFallback && !billedKrw ? (
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

      {fx.isFallback && !billedKrw ? (
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
          <dt className="text-ink-caption">시장환율 환산</dt>
          <dd>{marketKrw != null ? formatKRW(marketKrw) : fx.krw}</dd>
          {billedKrw != null ? (
            <>
              <dt className="text-ink-caption">실제 청구액</dt>
              <dd>{formatKRW(billedKrw)}</dd>
              {eff != null ? (
                <>
                  <dt className="text-ink-caption">실효 환율</dt>
                  <dd>
                    1 {expense.currency} = ₩{eff.toLocaleString("ko-KR")}
                  </dd>
                </>
              ) : null}
              {diffPct != null ? (
                <>
                  <dt className="text-ink-caption">{FX_MERGE_DIFF_LABEL}</dt>
                  <dd>{formatDiffPct(diffPct)}</dd>
                </>
              ) : null}
            </>
          ) : null}
          {feeKrw > 0 && billedKrw == null ? (
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

        {billedKrw == null ? (
          <div className="mt-2 flex flex-col gap-2 rounded-lg bg-surface-soft px-3 py-2">
            <label className="text-[11px] font-medium text-ink-body">
              실제 청구액(원)
              <input
                type="text"
                inputMode="numeric"
                value={billedInput}
                onChange={(e) => setBilledInput(e.target.value)}
                placeholder="예: 12500"
                className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-white px-3 text-sm text-ink-body"
                aria-label="실제 청구액 입력"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={submitBilled}
              className="min-h-[44px] rounded-lg bg-brand px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              청구액 반영
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={unmerge}
            className="mt-2 min-h-[44px] w-full rounded-lg bg-surface-soft px-3 text-xs font-bold text-ink-body disabled:opacity-50"
          >
            청구액 합치기 되돌리기
          </button>
        )}
        {error ? (
          <p className="mt-1 text-[11px] text-amber-900" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
