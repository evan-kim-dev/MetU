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
    <div className="rounded-xl bg-mu-sunken p-3">
      <p className="text-xs font-bold text-mu-fg">입금 계좌 (토스 송금)</p>
      <p className="mt-1 text-[11px] text-mu-fg-3">
        게스트 공유 링크(`/s/…`)에서 토스 딥링크에 쓰여요. 본인만 읽고 쓸 수
        있고, 유효한 공유 토큰으로만 게스트에게 전달돼요.
      </p>
      {!loaded ? (
        <p className="mt-2 text-xs text-mu-fg-3">불러오는 중…</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <input
            className="min-h-11 rounded-lg border border-mu-line bg-mu-card px-3 text-sm"
            placeholder="은행명 (예: 국민은행)"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            autoComplete="off"
          />
          <input
            className="min-h-11 rounded-lg border border-mu-line bg-mu-card px-3 text-sm"
            placeholder="계좌번호"
            value={accountNo}
            onChange={(e) => setAccountNo(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
          <button
            type="button"
            className="min-h-11 rounded-lg bg-mu-accent px-3 text-sm font-bold text-white disabled:opacity-50"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "저장 중…" : "입금 계좌 저장"}
          </button>
          {error ? (
            <p role="alert" className="text-xs font-bold text-mu-err">
              {error}
            </p>
          ) : null}
          {msg ? (
            <p role="status" className="text-xs font-bold text-mu-ok">
              {msg}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
