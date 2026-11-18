"use client";

import { Wallet } from "lucide-react";
import { computeCashPocket } from "@/lib/ledger/cash-pocket";
import type { LedgerExpenseRow } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";

type Props = {
  expenses: LedgerExpenseRow[];
};

/**
 * 현금 주머니 요약. 인출·환전(+) − 현금 지출(−).
 * 카드 UI 언어는 확인함/가계부와 같이 mu 카드 톤.
 */
export function CashPocketCard({ expenses }: Props) {
  const pocket = computeCashPocket(expenses);
  if (pocket.inflowCount === 0 && pocket.outflowCount === 0) {
    return (
      <section
        aria-label="현금 주머니"
        className="rounded-mu-xl border border-mu-line bg-mu-card px-4 py-4"
      >
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-mu-accent" strokeWidth={1.75} />
          <h2 className="text-mu-heading text-mu-fg">현금 주머니</h2>
        </div>
        <p className="mt-2 text-mu-caption text-mu-fg-3">
          ATM 인출·환전을 현금으로 기록하면 잔액이 쌓이고, 현금 지출을 빼 드려요.
        </p>
      </section>
    );
  }

  const currencies = Object.entries(pocket.byCurrency).filter(
    ([code]) => code !== "KRW"
  );

  return (
    <section
      aria-label="현금 주머니"
      className="rounded-mu-xl border border-mu-line bg-mu-card px-4 py-4"
    >
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-mu-accent" strokeWidth={1.75} />
        <h2 className="text-mu-heading text-mu-fg">현금 주머니</h2>
      </div>
      <p className="mu-num mt-2 text-mu-amount font-extrabold text-mu-fg">
        {formatKRW(pocket.krwBalance)}
      </p>
      <p className="mt-1 text-mu-caption text-mu-fg-3">
        원화 환산 잔액 · 인출 {pocket.inflowCount} · 지출 {pocket.outflowCount}
      </p>
      {currencies.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 border-t border-mu-line pt-3">
          {currencies.map(([code, amount]) => (
            <li
              key={code}
              className="flex min-h-tap items-center justify-between text-mu-caption"
            >
              <span className="font-semibold text-mu-fg-2">{code}</span>
              <span className="mu-num font-bold text-mu-fg">
                {amount.toLocaleString("ko-KR")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
