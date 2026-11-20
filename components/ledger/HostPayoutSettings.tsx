"use client";

import { useEffect, useState } from "react";
import {
  getPayoutProfile,
  upsertPayoutProfile,
} from "@/lib/ledger/supabase";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = {
  userId: string;
};

export function HostPayoutSettings({ userId }: Props) {
  const [bank, setBank] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setLoaded(true);
        return;
      }
      const row = await getPayoutProfile(supabase, userId);
      if (cancelled) return;
      if (row) {
        setBank(row.bank);
        setAccountNo(row.account_no);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function save() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setSaving(true);
    setError("");
    setMsg("");
    const row = await upsertPayoutProfile(supabase, {
      userId,
      bank,
      accountNo,
    });
    setSaving(false);
    if (!row) {
      setError("은행명과 계좌번호(숫자 4자리 이상)를 확인해 주세요.");
      return;
    }
    setBank(row.bank);
    setAccountNo(row.account_no);
    setMsg("입금 계좌를 저장했어요. 공유 정산 링크에 반영돼요.");
  }

  return (
    <div className="rounded-mu-lg border border-mu-line bg-mu-card p-3.5">
      <p className="text-mu-label font-bold text-mu-fg">입금 계좌</p>
      <p className="mt-1 text-mu-caption leading-snug text-mu-fg-3">
        공유 링크에서 게스트가 토스로 송금할 때 써요.
      </p>
      {!loaded ? (
        <p className="mt-3 text-mu-caption text-mu-fg-3">불러오는 중…</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <input
            className="min-h-11 rounded-mu-md border border-mu-line bg-mu-bg px-3 text-sm text-mu-fg"
            placeholder="은행명 (예: 국민은행)"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            autoComplete="off"
          />
          <input
            className="min-h-11 rounded-mu-md border border-mu-line bg-mu-bg px-3 text-sm text-mu-fg"
            placeholder="계좌번호"
            value={accountNo}
            onChange={(e) => setAccountNo(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
          <button
            type="button"
            className="min-h-11 rounded-mu-md bg-mu-accent px-3 text-sm font-bold text-mu-on-accent disabled:opacity-50"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "저장 중…" : "저장"}
          </button>
          {error ? (
            <p role="alert" className="text-mu-caption font-semibold text-mu-err">
              {error}
            </p>
          ) : null}
          {msg ? (
            <p role="status" className="text-mu-caption font-semibold text-mu-ok">
              {msg}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
