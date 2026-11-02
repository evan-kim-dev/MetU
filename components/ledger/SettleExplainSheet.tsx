"use client";

import { useEffect, useMemo } from "react";
import {
  explainReasonMessage,
  type ExplainResult,
} from "@/lib/ledger/explain";
import {
  convertTransfers,
  formatConvertedAmount,
  formatRateText,
} from "@/lib/ledger/settle-currency";
import { formatKRW } from "@/lib/shared/format";
import type { SettleReference } from "@/components/ledger/useSettleReference";

function signedKRW(value: number): string {
  if (value > 0) return `+${formatKRW(value)}`;
  if (value < 0) return `-${formatKRW(-value)}`;
  return formatKRW(0);
}

function balanceTone(value: number): string {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-amber-700";
  return "text-ink-muted";
}

interface SettleExplainSheetProps {
  open: boolean;
  onClose: () => void;
  result: ExplainResult;
  /** 지출이 바뀌어 저장된 송금표가 현재 지출과 다를 때 */
  stale: boolean;
  /** 이 여행 지출에 쓰인 외화 코드(KRW 제외). 빠른 선택 버튼으로 보여준다. */
  tripCurrencies: readonly string[];
  reference: SettleReference;
}

/**
 * "왜 이 금액?" 바텀시트. 낸 돈 − 쓴 몫 = 잔액, 송금 횟수가 줄어든 이유를 템플릿 문구로 보여주고
 * 선택한 통화로 참고 환산도 보여준다. 저장·송금 기준은 항상 원화예요.
 */
export function SettleExplainSheet({
  open,
  onClose,
  result,
  stale,
  tripCurrencies,
  reference,
}: SettleExplainSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const converted = useMemo(() => {
    if (!result.ok || !reference.currency || !reference.effective) return null;
    const r = convertTransfers(result.transferNotes, {
      currency: reference.currency,
      rate: reference.effective.rate,
    });
    return r.ok ? r : null;
  }, [result, reference.currency, reference.effective]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="왜 이 금액이에요?"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-2xl bg-white p-4 text-sm shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">왜 이 금액이에요?</h2>
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] px-2 text-xs font-bold text-brand"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        {!result.ok ? (
          <p
            role="alert"
            className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
          >
            {explainReasonMessage(result.reason)}
          </p>
        ) : (
          <>
            <section aria-label="멤버별 계산" className="flex flex-col gap-2">
              <p className="text-xs font-bold">
                낸 돈 − 쓴 몫 = 잔액이에요. 잔액이 +이면 받을 돈, −이면 보낼
                돈이에요.
              </p>
              <ul className="flex flex-col gap-2">
                {result.memberRows.map((m) => (
                  <li
                    key={m.memberId}
                    data-testid={`explain-member-${m.memberId}`}
                    className="rounded-xl bg-surface-soft px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{m.name}</span>
                      <span className={`font-semibold ${balanceTone(m.balance)}`}>
                        {signedKRW(m.balance)}
                      </span>
                    </div>
                    <p className="mt-1 text-ink-body">{m.summary}</p>
                    {m.lines.length > 0 ? (
                      <details className="mt-1">
                        <summary className="flex min-h-[44px] cursor-pointer items-center font-bold text-brand">
                          지출별로 보기 ({m.lines.length}건)
                        </summary>
                        <ul className="flex flex-col gap-1 pb-2">
                          {m.lines.map((l) => (
                            <li
                              key={l.expenseId}
                              className="flex items-start justify-between gap-2"
                            >
                              <span className="min-w-0 break-words">
                                {l.label}
                              </span>
                              <span className="shrink-0 text-right text-ink-muted">
                                낸 돈 {formatKRW(l.paid)} · 몫{" "}
                                {formatKRW(l.owed)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="송금 설명" className="flex flex-col gap-2">
              <p className="text-xs font-bold">송금은 이렇게 정해졌어요</p>
              {stale ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                  정산 후 지출이 바뀌어서 송금 설명은 정산을 다시 계산한 뒤에
                  볼 수 있어요.
                </p>
              ) : (
                <>
                  <p className="text-xs text-ink-body">{result.reductionNote}</p>
                  <ul className="flex flex-col gap-2">
                    {result.transferNotes.map((n, i) => (
                      <li
                        key={`${n.from}-${n.to}-${i}`}
                        className="rounded-xl bg-surface-soft px-3 py-2 text-xs text-ink-body"
                      >
                        {n.text}
                        {converted?.items[i] ? (
                          <span className="mt-1 block font-semibold text-ink-muted">
                            약{" "}
                            {formatConvertedAmount(
                              converted.items[i]!.amount,
                              converted.currency
                            )}{" "}
                            (참고)
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section
              aria-label="다른 통화로 참고하기"
              className="flex flex-col gap-2 rounded-xl border border-line-soft p-3 text-xs"
            >
              <p className="font-bold">다른 통화로 참고해서 보기</p>
              <p className="text-ink-muted">
                참고용이에요. 저장과 송금은 원화 기준 그대로예요.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={!reference.currency}
                  className={`min-h-[44px] rounded-lg border px-3 font-bold ${
                    !reference.currency
                      ? "border-brand bg-brand text-white"
                      : "border-brand text-brand"
                  }`}
                  onClick={() => reference.setCurrencyText("")}
                >
                  원화만
                </button>
                {tripCurrencies.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={reference.currency === c}
                    className={`min-h-[44px] rounded-lg border px-3 font-bold ${
                      reference.currency === c
                        ? "border-brand bg-brand text-white"
                        : "border-brand text-brand"
                    }`}
                    onClick={() => reference.setCurrencyText(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-1 font-semibold">
                통화 코드 직접 입력 (예: USD)
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  maxLength={3}
                  value={reference.currencyText}
                  onChange={(e) => reference.setCurrencyText(e.target.value)}
                  className="min-h-[44px] rounded-lg border border-line-soft px-3 text-sm uppercase"
                />
              </label>

              {reference.currency ? (
                <>
                  {reference.liveStatus === "loading" ? (
                    <p role="status" className="text-ink-muted">
                      환율을 가져오는 중이에요.
                    </p>
                  ) : null}
                  {reference.liveStatus === "error" ? (
                    <p role="alert" className="font-semibold text-amber-900">
                      환율을 가져오지 못했어요. 아래에 내 환율을 입력하면
                      환산해 드려요.
                    </p>
                  ) : null}
                  <label className="flex flex-col gap-1 font-semibold">
                    내 환율로 고정하기 (선택, 1 {reference.currency} = 원)
                    <input
                      type="text"
                      inputMode="decimal"
                      value={reference.fixedText}
                      onChange={(e) => reference.setFixedText(e.target.value)}
                      aria-invalid={reference.fixedError ? true : undefined}
                      className="min-h-[44px] rounded-lg border border-line-soft px-3 text-sm"
                    />
                  </label>
                  {reference.fixedError ? (
                    <p role="alert" className="font-semibold text-amber-900">
                      {reference.fixedError}
                    </p>
                  ) : null}
                  {reference.effective ? (
                    <p data-testid="reference-rate" className="font-semibold">
                      {formatRateText(
                        reference.currency,
                        reference.effective.rate
                      )}{" "}
                      ·{" "}
                      {reference.effective.source === "fixed"
                        ? "내가 고정한 환율"
                        : "지금 환율"}
                    </p>
                  ) : null}
                  {converted ? (
                    <p data-testid="reference-total" className="text-ink-body">
                      송금 합계 약{" "}
                      {formatConvertedAmount(converted.total, converted.currency)}
                      <span className="text-ink-muted">
                        {" "}
                        (원화 {formatKRW(result.totalKrw)})
                      </span>
                    </p>
                  ) : null}
                  <label className="flex min-h-[44px] items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={reference.includeInShare}
                      onChange={(e) =>
                        reference.setIncludeInShare(e.target.checked)
                      }
                      className="h-5 w-5"
                    />
                    공유 문구에도 환산 금액을 넣을게요
                  </label>
                </>
              ) : null}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
