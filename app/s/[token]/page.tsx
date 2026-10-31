"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  checkExpenseSum,
  parseSharedSettlementDetail,
  type SharedSettlementDetail,
  type SharedSettlementExpense,
} from "@/lib/ledger/shared-settlement";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const INVALID_LINK_MESSAGE = "링크가 유효하지 않아요.";
const LOAD_FAILED_MESSAGE =
  "정산을 불러오지 못했어요. 잠시 후 다시 열어 주세요.";

function transferStatusLabel(status: string): string {
  return status === "paid" ? "송금 완료" : "송금 전";
}

function settlementStatusLabel(status: string): string {
  if (status === "completed") return "정산 완료";
  if (status === "superseded") return "최신 아님";
  return "진행 중";
}

function formatForeign(amount: number, currency: string): string {
  return `${amount.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} ${currency}`;
}

function expenseSubline(
  e: SharedSettlementExpense,
  payerName: string
): string {
  const parts = [
    e.spentOn ?? "날짜 미상",
    `${payerName} 결제`,
  ];
  if (e.currency.trim().toUpperCase() !== "KRW") {
    parts.push(formatForeign(e.amount, e.currency));
    if (e.fxRateToKrw != null) {
      parts.push(
        `환율 ${e.fxRateToKrw.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}`
      );
    }
  }
  return parts.join(" · ");
}

export default function SharedSettlementPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedSettlementDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError(LOAD_FAILED_MESSAGE);
      return;
    }
    void (async () => {
      const { data: row, error: err } = await supabase.rpc(
        "get_shared_settlement_detail",
        { p_token: token }
      );
      if (err) {
        console.error("[shared-settlement] rpc", err.message);
        setError(LOAD_FAILED_MESSAGE);
        return;
      }
      const detail = row ? parseSharedSettlementDetail(row) : null;
      if (!detail) {
        setError(INVALID_LINK_MESSAGE);
        return;
      }
      setData(detail);
    })();
  }, [token]);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="p-8 text-center text-sm text-danger">
        {error}
      </p>
    );
  }
  if (!data) {
    return <p className="p-8 text-center text-sm text-ink-muted">불러오는 중…</p>;
  }

  const name = (id: string) =>
    data.members.find((m) => m.id === id)?.displayName ?? "?";
  const sumCheck = checkExpenseSum(data);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-xl font-extrabold text-ink-heading">정산 공유</h1>

      {data.status === "superseded" ? (
        <p
          role="status"
          className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
        >
          이 정산은 최신이 아니에요. 정산을 만든 분께 새 링크를 받아 주세요.
        </p>
      ) : null}

      <p className="mt-2 text-sm text-ink-body">
        {data.destination} · {data.dateRange}
      </p>
      <p className="text-xs text-ink-muted">
        v{data.version} · {settlementStatusLabel(data.status)}
        {data.completedAt ? ` · 완료 ${data.completedAt.slice(0, 10)}` : ""}
      </p>
      <p className="mt-3 text-sm font-bold">총 {formatKRW(data.totals.totalKrw)}</p>

      <section aria-label="보낼 돈" className="mt-4">
        <h2 className="text-sm font-extrabold text-ink-heading">송금할 내역</h2>
        {data.transfers.length === 0 ? (
          <p className="mt-2 text-xs text-ink-muted">
            주고받을 돈이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.transfers.map((t, i) => (
              <li
                key={`${t.from}-${t.to}-${i}`}
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-soft px-3 py-2 text-sm"
              >
                <span>
                  {name(t.from)} → {name(t.to)}{" "}
                  <strong>{formatKRW(t.krw)}</strong>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    t.status === "paid"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {transferStatusLabel(t.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="지출 내역" className="mt-6">
        <h2 className="text-sm font-extrabold text-ink-heading">지출 내역</h2>
        {data.expenses.length === 0 ? (
          <p className="mt-2 text-xs text-ink-muted">기록된 지출이 없어요.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.expenses.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-line-soft bg-surface-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink-heading">
                    {e.label}
                  </p>
                  <p className="text-xs text-ink-caption">
                    {expenseSubline(e, name(e.paidBy))}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-ink-heading">
                  {formatKRW(e.krwAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {sumCheck.kind === "match" ? (
          <p
            data-testid="sum-check"
            className="mt-3 text-xs font-semibold text-emerald-800"
          >
            지출 합계 {formatKRW(sumCheck.sumKrw)} · 총액과 일치해요 ✓
          </p>
        ) : sumCheck.kind === "mismatch" ? (
          <p
            data-testid="sum-check"
            role="alert"
            className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
          >
            지출 합계({formatKRW(sumCheck.sumKrw)})와 총액(
            {formatKRW(sumCheck.totalKrw)})이 달라요. 정산을 만든 분께
            확인해 주세요.
          </p>
        ) : (
          <p
            data-testid="sum-check"
            className="mt-3 text-xs font-semibold text-ink-muted"
          >
            지출이 {sumCheck.total}건이라 {sumCheck.shown}건만 보여 드려요.
            합계는 대조하지 않았어요.
          </p>
        )}
      </section>
    </div>
  );
}
