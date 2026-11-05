"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkExpenseSum,
  parseSharedSettlementDetail,
  type SharedSettlementDetail,
  type SharedSettlementExpense,
} from "@/lib/ledger/shared-settlement";
import { executeTossTransfer } from "@/lib/ledger/toss";
import { AmountCard } from "@/components/ds/AmountCard";
import { Button } from "@/components/ds/Button";
import { ToastProvider, useOptionalToast } from "@/components/ds/Toast";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const INVALID_LINK_MESSAGE = "링크가 유효하지 않아요.";
const LOAD_FAILED_MESSAGE =
  "정산을 불러오지 못했어요. 잠시 후 다시 열어 주세요.";

/**
 * VERIFY: 데모용 호스트 입금 계좌. 공유 RPC 에 계좌 필드가 없어 임시 상수.
 * 지갑/프로필 스키마 연동 후 서버 값으로 교체.
 */
const DEMO_HOST_PAYOUT = {
  bank: "국민은행",
  accountNo: "943202-00-709112",
} as const;

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

function formatFeePct(pct: number): string {
  const abs = Math.abs(pct).toFixed(1);
  if (pct > 0) return `+${abs}%`;
  if (pct < 0) return `-${abs}%`;
  return "0.0%";
}

function expenseSubline(
  e: SharedSettlementExpense,
  payerName: string
): string {
  const parts = [e.spentOn ?? "날짜 미상", `${payerName} 결제`];
  if (e.currency.trim().toUpperCase() !== "KRW") {
    parts.push(formatForeign(e.amount, e.currency));
    if (e.fxRateToKrw != null) {
      parts.push(
        `환율 ${e.fxRateToKrw.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}`
      );
    }
  }
  if (e.billedKrw != null) {
    parts.push(`청구 ${formatKRW(e.billedKrw)}`);
    if (e.feePct != null) {
      parts.push(`시장환율 대비 ${formatFeePct(e.feePct)}`);
    }
  }
  return parts.join(" · ");
}

function SharedSettlementInner() {
  const { token } = useParams<{ token: string }>();
  const toast = useOptionalToast();
  const [data, setData] = useState<SharedSettlementDetail | null>(null);
  const [error, setError] = useState("");
  const [meId, setMeId] = useState("");
  const busy = useRef(false);

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
      if (detail.members[0]) setMeId(detail.members[0].id);
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

  const myOutgoing = useMemo(() => {
    if (!data || !meId) return [];
    return data.transfers.filter((t) => t.from === meId && t.status !== "paid");
  }, [data, meId]);

  const myAmount = useMemo(
    () => myOutgoing.reduce((s, t) => s + t.krw, 0),
    [myOutgoing]
  );

  if (error) {
    return (
      <p role="alert" className="p-8 text-center text-sm text-mu-err">
        {error}
      </p>
    );
  }
  if (!data) {
    return <p className="p-8 text-center text-sm text-mu-fg-3">불러오는 중…</p>;
  }

  const name = (id: string) =>
    data.members.find((m) => m.id === id)?.displayName ?? "?";
  const sumCheck = checkExpenseSum(data);

  async function handleTossPay() {
    if (busy.current || myAmount <= 0) return;
    busy.current = true;
    try {
      await executeTossTransfer({
        bank: DEMO_HOST_PAYOUT.bank,
        accountNo: DEMO_HOST_PAYOUT.accountNo,
        amount: myAmount,
        onSuccessCopy: () => {
          toast?.show({
            text: "계좌번호와 금액이 복사되었어요!",
            tone: "ok",
          });
        },
      });
    } catch (e) {
      console.error("[toss-transfer]", e instanceof Error ? e.message : e);
      toast?.show({
        text: "송금을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
        tone: "err",
      });
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="mu-root mx-auto max-w-mobile px-4 py-8 pb-28">
      <h1 className="text-mu-title text-mu-fg">정산 공유</h1>

      {data.status === "superseded" ? (
        <p
          role="status"
          className="mt-3 rounded-xl bg-mu-warn-soft px-3 py-2 text-xs font-bold text-mu-warn"
        >
          이 정산은 최신이 아니에요. 정산을 만든 분께 새 링크를 받아 주세요.
        </p>
      ) : null}

      <p className="mt-2 text-mu-body text-mu-fg-2">
        {data.destination} · {data.dateRange}
      </p>
      <p className="text-mu-caption text-mu-fg-3">
        v{data.version} · {settlementStatusLabel(data.status)}
        {data.completedAt ? ` · 완료 ${data.completedAt.slice(0, 10)}` : ""}
      </p>

      <div className="mt-4">
        <AmountCard
          label="총지출"
          amount={data.totals.totalKrw}
          tone="neutral"
        />
      </div>

      <section
        aria-label="토스 송금"
        className="mt-4 rounded-2xl border border-mu-line bg-mu-card p-4"
      >
        <h2 className="text-sm font-extrabold text-mu-fg">1초 송금</h2>
        <label className="mt-3 block text-xs font-bold text-mu-fg-2">
          나는
          <select
            className="mt-1 min-h-11 w-full rounded-xl border border-mu-line bg-mu-bg px-3 text-sm text-mu-fg"
            value={meId}
            onChange={(e) => setMeId(e.target.value)}
          >
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3">
          <AmountCard label="내가 보낼 금액" amount={myAmount} tone="accent" />
        </div>

        {myAmount > 0 ? (
          <div className="mt-4">
            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={() => void handleTossPay()}
            >
              토스로 {formatKRW(myAmount)} 송금하기
            </Button>
            <p className="mt-2 text-xs text-mu-fg-3">
              모바일에서는 토스 앱을 열고, PC에서는 계좌·금액을 복사해요.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-mu-fg-3">지금 보낼 금액이 없어요.</p>
        )}
      </section>

      <section aria-label="보낼 돈" className="mt-6">
        <h2 className="text-sm font-extrabold text-mu-fg">송금할 내역</h2>
        {data.transfers.length === 0 ? (
          <p className="mt-2 text-xs text-mu-fg-3">주고받을 돈이 없어요.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.transfers.map((t, i) => (
              <li
                key={`${t.from}-${t.to}-${i}`}
                className="flex items-center justify-between gap-2 rounded-xl bg-mu-sunken px-3 py-2 text-sm"
              >
                <span>
                  {name(t.from)} → {name(t.to)}{" "}
                  <strong>{formatKRW(t.krw)}</strong>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                    t.status === "paid"
                      ? "bg-mu-ok-soft text-mu-ok"
                      : "bg-mu-warn-soft text-mu-warn"
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
        <h2 className="text-sm font-extrabold text-mu-fg">지출 내역</h2>
        {data.expenses.length === 0 ? (
          <p className="mt-2 text-xs text-mu-fg-3">기록된 지출이 없어요.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.expenses.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-mu-line bg-mu-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-mu-fg">
                    {e.label}
                  </p>
                  <p className="text-xs text-mu-fg-3">
                    {expenseSubline(e, name(e.paidBy))}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-mu-fg">
                  {formatKRW(e.krwAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {sumCheck.kind === "match" ? (
          <p
            data-testid="sum-check"
            className="mt-3 text-xs font-semibold text-mu-ok"
          >
            지출 합계 {formatKRW(sumCheck.sumKrw)} · 총액과 일치해요 ✓
          </p>
        ) : sumCheck.kind === "mismatch" ? (
          <p
            data-testid="sum-check"
            role="alert"
            className="mt-3 rounded-lg bg-mu-warn-soft px-3 py-2 text-xs font-bold text-mu-warn"
          >
            지출 합계({formatKRW(sumCheck.sumKrw)})와 총액(
            {formatKRW(sumCheck.totalKrw)})이 달라요. 정산을 만든 분께
            확인해 주세요.
          </p>
        ) : (
          <p
            data-testid="sum-check"
            className="mt-3 text-xs font-semibold text-mu-fg-3"
          >
            지출이 {sumCheck.total}건이라 {sumCheck.shown}건만 보여 드려요.
            합계는 대조하지 않았어요.
          </p>
        )}
      </section>
    </div>
  );
}

export default function SharedSettlementPage() {
  return (
    <ToastProvider>
      <SharedSettlementInner />
    </ToastProvider>
  );
}
