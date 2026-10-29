"use client";

import { useState } from "react";
import { listCardProfiles, upsertCardProfile } from "@/lib/ledger/supabase";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  label: string;
  kind: string;
  fee_rate: number | null;
  fee_flat_krw: number;
};

type Props = {
  userId: string;
  profiles: Profile[];
  onChange: (next: Profile[]) => void;
};

export function CardProfileSettings({ userId, profiles, onChange }: Props) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<
    "credit" | "debit" | "travel_prepaid" | "cash"
  >("credit");
  const [feeRatePct, setFeeRatePct] = useState("");
  const [feeFlat, setFeeFlat] = useState("");
  const [error, setError] = useState("");

  async function save() {
    const supabase = getBrowserSupabase();
    if (!supabase || !label.trim()) return;
    setError("");
    const feeRate =
      feeRatePct.trim() === ""
        ? null
        : Number(feeRatePct) / 100;
    if (feeRate != null && (!Number.isFinite(feeRate) || feeRate < 0 || feeRate > 0.1)) {
      setError("수수료율은 0~10% 사이예요.");
      return;
    }
    const row = await upsertCardProfile(supabase, {
      userId,
      label: label.trim().slice(0, 40),
      kind,
      feeRate,
      feeFlatKrw: Math.max(0, Math.trunc(Number(feeFlat) || 0)),
    });
    if (!row) {
      setError("저장 실패");
      return;
    }
    const next = await listCardProfiles(supabase);
    onChange(next as Profile[]);
    setLabel("");
    setFeeRatePct("");
    setFeeFlat("");
  }

  return (
    <div className="rounded-xl bg-surface-soft p-3">
      <p className="text-xs font-bold text-ink-heading">카드 프로필</p>
      <p className="mt-1 text-[11px] text-ink-muted">
        카드사/약관의 해외결제 수수료를 직접 입력하세요. 비워 두면 0으로 계산하고
        표시해요.
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-xs">
        {profiles.map((p) => (
          <li key={p.id} className="rounded-lg bg-surface-white px-2 py-1">
            {p.label} ·{" "}
            {p.fee_rate == null
              ? "수수료 미설정"
              : `${(Number(p.fee_rate) * 100).toFixed(2)}%`}
            {p.fee_flat_krw ? ` +${p.fee_flat_krw}원` : ""}
          </li>
        ))}
      </ul>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          className="col-span-2 rounded-lg border border-line px-2 py-1.5 text-xs"
          placeholder="이름 (예: 신한 신용)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <select
          className="rounded-lg border border-line px-2 py-1.5 text-xs"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="credit">신용카드</option>
          <option value="debit">체크</option>
          <option value="travel_prepaid">트래블 선불</option>
          <option value="cash">현금</option>
        </select>
        <input
          inputMode="decimal"
          className="rounded-lg border border-line px-2 py-1.5 text-xs"
          placeholder="수수료율 %"
          value={feeRatePct}
          onChange={(e) => setFeeRatePct(e.target.value)}
        />
        <input
          inputMode="numeric"
          className="col-span-2 rounded-lg border border-line px-2 py-1.5 text-xs"
          placeholder="건당 고정 수수료(원)"
          value={feeFlat}
          onChange={(e) => setFeeFlat(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white"
        onClick={() => void save()}
      >
        프로필 추가
      </button>
      {error ? (
        <p className="mt-1 text-xs font-semibold text-danger">{error}</p>
      ) : null}
    </div>
  );
}
