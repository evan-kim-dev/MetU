"use client";

import { useMemo, useState } from "react";
import { transferTripHost } from "@/lib/ledger/supabase";
import type { TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = {
  tripId: string;
  meId: string;
  members: TripMember[];
  onTransferred: () => void;
};

export function HostTransferSettings({
  tripId,
  meId,
  members,
  onTransferred,
}: Props) {
  const candidates = useMemo(
    () =>
      members.filter(
        (m) => m.id !== meId && Boolean(m.userId) && !m.isOwner
      ),
    [members, meId]
  );
  const [targetId, setTargetId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const target = candidates.find((m) => m.id === targetId) ?? null;

  async function submit() {
    if (!target || busy) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setOk("");
    const res = await transferTripHost(supabase, tripId, target.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOk(`${target.displayName}님에게 호스트를 넘겼어요.`);
    setConfirm(false);
    setTargetId("");
    onTransferred();
  }

  return (
    <div className="rounded-mu-lg border border-mu-line bg-mu-card p-3.5">
      <p className="text-mu-label font-bold text-mu-fg">호스트 넘기기</p>
      <p className="mt-1 text-mu-caption leading-snug text-mu-fg-3">
        설정·초대·정산 권한이 선택한 동행에게 넘어가요.
      </p>

      {candidates.length === 0 ? (
        <p className="mt-3 text-mu-caption text-mu-fg-3">
          가입한 동행이 생기면 넘길 수 있어요.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <select
            className="min-h-11 w-full rounded-mu-md border border-mu-line bg-mu-bg px-3 text-sm text-mu-fg"
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setConfirm(false);
              setError("");
              setOk("");
            }}
            aria-label="새 호스트"
          >
            <option value="">동행 선택</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>

          {!confirm ? (
            <button
              type="button"
              className="min-h-11 rounded-mu-md border border-mu-line bg-mu-bg px-3 text-sm font-bold text-mu-fg disabled:opacity-50"
              disabled={!target}
              onClick={() => setConfirm(true)}
            >
              호스트 넘기기
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-mu-caption font-semibold text-mu-warn">
                {target?.displayName}님에게 넘길까요? 되돌리려면 새 호스트가 다시
                넘겨줘야 해요.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="min-h-11 flex-1 rounded-mu-md border border-mu-line bg-mu-bg px-3 text-sm font-bold text-mu-fg"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="min-h-11 flex-1 rounded-mu-md bg-mu-accent px-3 text-sm font-bold text-mu-on-accent disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  {busy ? "넘기는 중…" : "확인"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-mu-caption font-semibold text-mu-err">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p role="status" className="mt-2 text-mu-caption font-semibold text-mu-ok">
          {ok}
        </p>
      ) : null}
    </div>
  );
}
