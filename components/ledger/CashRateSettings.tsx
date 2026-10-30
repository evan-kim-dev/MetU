"use client";

import { useState } from "react";
import { FxAttribution } from "@/components/fx/FxAttribution";
import { useCurrencyOptions } from "@/lib/fx/currency-list";
import { rateFromCash } from "@/lib/ledger/money";
import { upsertCashRate } from "@/lib/ledger/supabase";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = {
  tripId: string;
  memberId: string;
};

export function CashRateSettings({ tripId, memberId }: Props) {
  const currencyOptions = useCurrencyOptions();
  const [currency, setCurrency] = useState("JPY");
  const [foreign, setForeign] = useState("10000");
  const [krw, setKrw] = useState("91000");
  const [msg, setMsg] = useState("");

  async function save() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const f = Number(foreign);
    const k = Number(krw);
    const rate = rateFromCash(f, k);
    if (!(rate > 0)) {
      setMsg("금액을 확인해 주세요.");
      return;
    }
    const row = await upsertCashRate(supabase, {
      tripId,
      memberId,
      currency,
      krwPerUnit: rate,
      note: `${f} → ${k}원`,
    });
    setMsg(row ? `저장됨: 1 ${currency} = ${rate}원` : "저장 실패");
  }

  return (
    <div className="rounded-xl bg-surface-soft p-3">
      <p className="text-xs font-bold text-ink-heading">내 현금 환전 환율</p>
      <p className="mt-1 text-[11px] text-ink-muted">
        예: 10,000엔을 91,000원에 환전하면 단가가 자동 계산돼요.
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <select
          className="rounded-lg border border-line px-2 py-1.5 text-xs"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {!currencyOptions.some((o) => o.code === currency) ? (
            <option value={currency}>{currency}</option>
          ) : null}
          {currencyOptions
            .filter((o) => o.code !== "KRW")
            .map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
        </select>
        <input
          inputMode="decimal"
          className="rounded-lg border border-line px-2 py-1.5 text-xs"
          value={foreign}
          onChange={(e) => setForeign(e.target.value)}
          placeholder="외화"
        />
        <input
          inputMode="numeric"
          className="rounded-lg border border-line px-2 py-1.5 text-xs"
          value={krw}
          onChange={(e) => setKrw(e.target.value)}
          placeholder="원화"
        />
      </div>
      <button
        type="button"
        className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white"
        onClick={() => void save()}
      >
        환율 저장
      </button>
      {msg ? <p className="mt-1 text-xs text-ink-body">{msg}</p> : null}
      <FxAttribution />
    </div>
  );
}
