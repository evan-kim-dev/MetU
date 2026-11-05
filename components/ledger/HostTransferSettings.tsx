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
    <div className="rounded-xl bg-mu-sunken p-3">
      <p className="text-xs font-bold text-mu-fg">호스트 넘기기</p>
      <p className="mt-1 text-[11px] text-mu-fg-3">
        가입한 동행에게만 넘길 수 있어요. 넘기면 설정·초대·정산 권한이 그쪽으로
        옮겨지고, 나는 일반 멤버가 돼요.
      </p>

      {candidates.length === 0 ? (
        <p className="mt-2 text-xs text-mu-fg-3">
          넘길 수 있는 가입 동행이 아직 없어요. 초대 링크로 들어오게 한 뒤 다시
          시도해 주세요.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <select
            className="min-h-11 w-full rounded-lg border border-mu-line bg-mu-card px-3 text-sm"
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
              className="min-h-11 rounded-lg border border-mu-line bg-mu-card px-3 text-sm font-bold text-mu-fg disabled:opacity-50"
              disabled={!target}
              onClick={() => setConfirm(true)}
            >
              호스트 넘기기
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-mu-warn">
                {target?.displayName}님에게 호스트를 넘길까요? 되돌리려면 새
                호스트가 다시 넘겨줘야 해요.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="min-h-11 flex-1 rounded-lg border border-mu-line bg-mu-card px-3 text-sm font-bold"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="min-h-11 flex-1 rounded-lg bg-mu-accent px-3 text-sm font-bold text-white disabled:opacity-50"
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
        <p role="alert" className="mt-2 text-xs font-bold text-mu-err">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p role="status" className="mt-2 text-xs font-bold text-mu-ok">
          {ok}
        </p>
      ) : null}
    </div>
  );
}
