"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
  const [anonBusy, setAnonBusy] = useState(false);
  const [anonError, setAnonError] = useState("");

  const needsAuth = !user || provider === "guest";

  const loadPreview = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("연결을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.rpc("preview_trip_invite", {
      p_token: token,
    });
    if (err || !data) {
      setError("초대가 만료되었거나 유효하지 않아요.");
      setPreview(null);
      setLoading(false);
      return;
    }
    const p = data as Preview;
    setPreview(p);
    setClaimId(p.claimMemberId ?? "");
    setError("");
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (needsAuth) {
      setLoading(false);
      return;
    }
    void loadPreview();
  }, [needsAuth, loadPreview]);

  async function joinAnonymously() {
    setAnonBusy(true);
    setAnonError("");
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setAnonError("연결을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.");
      setAnonBusy(false);
      return;
    }
    const { error: authErr } = await supabase.auth.signInAnonymously();
    if (authErr) {
      console.error("[join] signInAnonymously", authErr.message);
      const msg = authErr.message.toLowerCase();
      if (msg.includes("captcha") || msg.includes("disabled") || msg.includes("anonymous")) {
        setAnonError(
          "가입 없이 참여를 쓸 수 없어요. 로그인한 뒤 다시 시도해 주세요."
        );
      } else if (msg.includes("rate") || msg.includes("limit")) {
        setAnonError(
          "요청이 많아요. 잠시 후 다시 시도하거나 로그인해 주세요."
        );
      } else {
        setAnonError(
          "가입 없이 참여에 실패했어요. 로그인한 뒤 다시 시도해 주세요."
        );
      }
      setAnonBusy(false);
      return;
    }
    // AuthProvider 가 세션을 반영하면 needsAuth 가 false 가 되어 preview 를 불러요.
    setAnonBusy(false);
  }

  if (needsAuth) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-sm font-bold text-mu-fg">
          이름만으로 여행에 참여할 수 있어요
        </p>
        <p className="mt-2 text-xs text-mu-fg-3">
          가입 없이 참여하면 이 기기에서 가계부와 정산을 볼 수 있어요.
        </p>
        {anonError ? (
          <p role="alert" className="mt-3 text-xs font-semibold text-mu-err">
            {anonError}
          </p>
        ) : null}
        <button
          type="button"
          disabled={anonBusy}
          onClick={() => void joinAnonymously()}
          className="mt-4 inline-flex min-h-tap w-full items-center justify-center rounded-xl bg-mu-accent px-4 py-3 text-sm font-extrabold text-mu-on-accent disabled:opacity-60"
        >
          {anonBusy ? "준비 중…" : "가입 없이 참여"}
        </button>
        <Link
          href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
          className="mt-3 inline-block text-sm font-bold text-mu-accent underline"
        >
          로그인
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-mu-fg-3">불러오는 중…</div>
    );
  }

  if (error || !preview) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-mu-err">
        {error || "초대를 열 수 없어요."}
        <p className="mt-3 text-xs text-mu-fg-3">
          세션이 사라졌다면 처음 초대 링크를 다시 열어 주세요.
        </p>
      </div>
    );
  }

  async function join() {
    const trimmed = name.trim();
    if (!claimId && (trimmed.length < 1 || trimmed.length > 20)) {
      setError("이름은 1~20자로 입력해 주세요.");
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data, error: err } = await supabase.rpc("join_trip", {
      p_token: token,
      p_claim_member_id: claimId || null,
      p_display_name: claimId ? null : trimmed,
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
      await afterJoinTrip(preview!.tripId);
    } catch (e) {
      console.error("[join] afterJoinTrip", e instanceof Error ? e.message : e);
    }
    router.replace(`/trips/${preview!.tripId}/ledger`);
  }

  return (
    <div className="mu-root mx-auto flex max-w-mobile flex-col gap-4 px-4 py-8">
      <h1 className="text-mu-title text-mu-fg">여행 초대</h1>
      <p className="text-mu-body text-mu-fg-2">
        {preview.ownerName}님의 {preview.destination}에 초대받았어요
      </p>
      <p className="text-mu-caption text-mu-fg-3">{preview.dateRange}</p>

      <fieldset className="rounded-xl bg-mu-sunken p-3">
        <legend className="text-xs font-bold">내 이름 선택</legend>
        {preview.members
          .filter((m) => m.claimable)
          .map((m) => (
            <label key={m.id} className="mt-2 flex min-h-tap items-center gap-2 text-sm">
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
          <span className="flex min-h-tap items-center gap-2">
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
              className="min-h-tap rounded-lg border border-mu-line-strong bg-mu-card px-2 py-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="표시 이름 (1~20자)"
              maxLength={20}
              required
            />
          ) : null}
        </label>
      </fieldset>

      {error ? (
        <p className="text-xs font-semibold text-mu-err">{error}</p>
      ) : null}

      <button
        type="button"
        className="min-h-tap rounded-xl bg-mu-accent py-3 text-sm font-extrabold text-mu-on-accent"
        onClick={() => void join()}
      >
        참여하기
      </button>
    </div>
  );
}
