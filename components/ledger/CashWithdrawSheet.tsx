"use client";

import { useState } from "react";
import { Button } from "@/components/ds/Button";
import { Sheet } from "@/components/ds/Sheet";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import { useCurrencyOptions } from "@/lib/fx/currency-list";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 확인 시트로 넘길 초안 (paymentMethod=cash, 라벨에 인출) */
  onDraft: (draft: ExpenseDraftInput) => void;
};

/**
 * 현금 인출·환전 입력. 가계부에 현금으로 쌓여 주머니 잔액이 늘어나요.
 */
export function CashWithdrawSheet({ open, onClose, onDraft }: Props) {
  const currencyOptions = useCurrencyOptions();
  const [currency, setCurrency] = useState("JPY");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("ATM 인출");
  const [error, setError] = useState("");

  if (!open) return null;

  function submit() {
    const n = Number(amount);
    if (!(n > 0)) {
      setError("금액을 확인해 주세요.");
      return;
    }
    const label = (note.trim() || "ATM 인출").slice(0, 80);
    // 라벨에 인출·환전이 들어가 cash-pocket 유입으로 잡혀요.
    const withHint = /인출|환전|atm/i.test(label) ? label : `${label} 인출`;
    onDraft({
      source: "manual",
      origin: "manual",
      merchant: withHint,
      amount: n,
      currency,
      category: "기타",
      paymentMethod: "cash",
      spentOn: new Date().toISOString().slice(0, 10),
      kind: "approval",
    });
    setAmount("");
    setError("");
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title="현금 인출·환전">
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-mu-caption text-mu-fg-3">
          인출·환전을 기록하면 현금 주머니 잔액이 늘고, 이후 현금 지출에서
          빠져요. 실제 가계부에도 같은 장부로 남아요.
        </p>
        <label className="flex flex-col gap-1 text-mu-caption font-bold text-mu-fg">
          통화
          <select
            className="min-h-tap rounded-mu-md border border-mu-line bg-mu-sunken px-3 text-mu-body font-normal"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {!currencyOptions.some((o) => o.code === currency) ? (
              <option value={currency}>{currency}</option>
            ) : null}
            {currencyOptions.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-mu-caption font-bold text-mu-fg">
          금액
          <input
            inputMode="decimal"
            className="min-h-tap rounded-mu-md border border-mu-line bg-mu-sunken px-3 text-mu-body font-normal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10000"
          />
        </label>
        <label className="flex flex-col gap-1 text-mu-caption font-bold text-mu-fg">
          메모
          <input
            className="min-h-tap rounded-mu-md border border-mu-line bg-mu-sunken px-3 text-mu-body font-normal"
            value={note}
            maxLength={80}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="text-mu-caption font-semibold text-mu-err">
            {error}
          </p>
        ) : null}
        <Button onClick={submit}>확인 시트로</Button>
      </div>
    </Sheet>
  );
}
