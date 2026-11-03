"use client";

import { useState } from "react";

import { Sheet } from "@/components/ds/Sheet";
import { setExpensePayer } from "@/lib/ledger/supabase";
import type { TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = {
  open: boolean;
  onClose: () => void;
  expenseId: string;
  members: TripMember[];
  currentPayerId: string;
  onSaved: () => void | Promise<void>;
};

export function ExpensePayerSheet({
  open,
  onClose,
  expenseId,
  members,
  currentPayerId,
  onSaved,
}: Props) {
  const [selected, setSelected] = useState(currentPayerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (selected === currentPayerId) {
      onClose();
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("로그인이 필요해요.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await setExpensePayer(supabase, expenseId, selected);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await onSaved();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="결제자 바꾸기">
      <p className="text-xs text-mu-fg-3">
        결제한 사람만 바꿔요. 금액과 분담은 그대로예요. 카드 수수료는 다시
        계산하지 않아요.
      </p>
      <ul className="mt-3 flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.id}>
            <label className="flex min-h-[44px] items-center gap-3 rounded-lg px-2 hover:bg-mu-sunken">
              <input
                type="radio"
                name="payer"
                checked={selected === m.id}
                onChange={() => setSelected(m.id)}
              />
              <span className="text-sm font-bold text-mu-fg">
                {m.displayName}
                {m.id === currentPayerId ? " (현재)" : ""}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-mu-err">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        className="mt-3 min-h-[44px] w-full rounded-xl bg-mu-accent text-sm font-bold text-white disabled:opacity-60"
        onClick={() => void save()}
      >
        저장
      </button>
    </Sheet>
  );
}
