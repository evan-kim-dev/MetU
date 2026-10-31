"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useTrips } from "@/lib/trips/TripProvider";

type Preview = {
  tripId: string;
  destination: string;
  dateRange: string;
  ownerName: string;
  members: Array<{ id: string; displayName: string; claimable: boolean }>;
  claimMemberId: string | null;
};

export default function JoinTripPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { user, provider } = useAuth();
  const router = useRouter();
  const { afterJoinTrip } = useTrips();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [claimId, setClaimId] = useState<string>("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (provider === "guest" || !user) {
      setLoading(false);
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    void (async () => {
      const { data, error: err } = await supabase.rpc("preview_trip_invite", {
        p_token: token,
      });
      if (err || !data) {
        setError("초대가 만료되었거나 유효하지 않아요.");
        setLoading(false);
        return;
      }
      const p = data as Preview;
      setPreview(p);
      setClaimId(p.claimMemberId ?? "");
      setLoading(false);
    })();
  }, [token, user, provider]);

  if (!user || provider === "guest") {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-sm font-bold text-ink-heading">초대를 수락하려면 로그인이 필요해요</p>
        <Link
          href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
          className="mt-4 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white"
        >
          로그인
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-ink-muted">불러오는 중…</div>;
  }

  if (error || !preview) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-danger">
        {error || "초대를 열 수 없어요."}
      </div>
    );
  }

  async function join() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data, error: err } = await supabase.rpc("join_trip", {
      p_token: token,
      p_claim_member_id: claimId || null,
      p_display_name: name || null,
    });
    if (err || !data) {
      console.error("[join] join_trip", err?.message ?? "no-data");
      setError(
        err?.message?.includes("invite-invalid")
          ? "초대가 만료되었거나 유효하지 않아요."
          : "합류에 실패했어요. 잠시 후 다시 시도해 주세요."
      );
      return;
    }
    try {
      // 목록을 갱신하고 합류한 여행 기간의 미배정 알림을 다시 매칭해요.
      await afterJoinTrip(preview!.tripId);
    } catch (e) {
      console.error("[join] afterJoinTrip", e instanceof Error ? e.message : e);
    }
    router.replace(`/trips/${preview!.tripId}/ledger`);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-extrabold text-ink-heading">여행 초대</h1>
      <p className="text-sm text-ink-body">
        {preview.destination} · {preview.dateRange}
      </p>
      <p className="text-xs text-ink-muted">호스트 {preview.ownerName}</p>

      <fieldset className="rounded-xl bg-surface-soft p-3">
        <legend className="text-xs font-bold">내 이름 선택</legend>
        {preview.members
          .filter((m) => m.claimable)
          .map((m) => (
            <label key={m.id} className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="claim"
                checked={claimId === m.id}
                onChange={() => {
                  setClaimId(m.id);
                  setName("");
                }}
              />
              {m.displayName} (나예요)
            </label>
          ))}
        <label className="mt-2 flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-2">
            <input
              type="radio"
              name="claim"
              checked={!claimId}
              onChange={() => setClaimId("")}
            />
            새 이름
          </span>
          {!claimId ? (
            <input
              className="rounded-lg border border-line px-2 py-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="표시 이름"
              maxLength={30}
            />
          ) : null}
        </label>
      </fieldset>

      {error ? (
        <p className="text-xs font-semibold text-danger">{error}</p>
      ) : null}

      <button
        type="button"
        className="rounded-xl bg-brand py-3 text-sm font-extrabold text-white"
        onClick={() => void join()}
      >
        합류하기
      </button>
    </div>
  );
}
