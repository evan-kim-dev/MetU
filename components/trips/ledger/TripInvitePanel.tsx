"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import type { TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/** create_trip_invite 기본값(마이그레이션 20261029140000)과 문구를 맞춘다. */
const DEFAULT_TTL_HOURS = 72;
const DEFAULT_MAX_USES = 10;

const ALL_KEY = "__all__";

interface TripInvitePanelProps {
  tripId: string;
  members: TripMember[];
  /** 소유자만 true. false 면 아무것도 그리지 않는다. */
  canInvite: boolean;
}

function inviteUrl(token: string): string {
  return `${window.location.origin}/join/${token}`;
}

/**
 * 동행자 초대 링크 만들기 (소유자 전용).
 * - 일반 초대: 링크로 들어온 사람이 이름을 고르거나 새로 정해요.
 * - 이름만 있는 멤버(아직 계정이 없는 사람)는 그 사람 몫으로 지정한 1회용 링크를 따로 만들어요.
 * 링크(토큰)는 이 화면의 상태에만 두고 로그/분석에는 남기지 않아요.
 */
export function TripInvitePanel({
  tripId,
  members,
  canInvite,
}: TripInvitePanelProps) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!canInvite) return null;

  const claimable = members.filter((m) => !m.userId && !m.isOwner);

  async function createInvite(key: string, claimMemberId?: string) {
    if (busyKey) return;
    setBusyKey(key);
    setError("");
    setCopiedKey(null);
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setError("초대 링크를 만들지 못했어요. 로그인 상태를 확인해 주세요.");
        return;
      }
      const { data, error: rpcError } = await supabase.rpc(
        "create_trip_invite",
        claimMemberId
          ? {
              p_trip_id: tripId,
              p_claim_member_id: claimMemberId,
              p_max_uses: 1,
            }
          : { p_trip_id: tripId }
      );
      if (rpcError || typeof data !== "string" || data.length === 0) {
        console.error("[invite] create_trip_invite", rpcError?.message ?? "empty");
        setError("초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setLinks((prev) => ({ ...prev, [key]: inviteUrl(data) }));
    } finally {
      setBusyKey(null);
    }
  }

  async function copyLink(key: string) {
    const url = links[key];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      setError("링크를 복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.");
    }
  }

  async function shareLink(key: string, who: string) {
    const url = links[key];
    if (!url || typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: "여행 초대",
        text: `${who}, 같이 정산해요. 이 링크로 들어와 주세요.`,
        url,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error("[invite] share", e instanceof Error ? e.message : e);
      setError("공유하지 못했어요. 링크를 복사해서 보내 주세요.");
    }
  }

  function renderLink(key: string, who: string) {
    const url = links[key];
    if (!url) return null;
    const canNativeShare = typeof navigator.share === "function";
    return (
      <div className="mt-2 flex flex-col gap-2">
        <input
          readOnly
          aria-label={`${who} 초대 링크`}
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-full rounded-xl border border-line-muted bg-surface-white px-3 text-xs text-ink-body"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyLink(key)}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-brand px-3 text-xs font-bold text-surface-white"
          >
            {copiedKey === key ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copiedKey === key ? "복사했어요" : "링크 복사"}
          </button>
          {canNativeShare ? (
            <button
              type="button"
              onClick={() => void shareLink(key, who)}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-brand px-3 text-xs font-bold text-brand"
            >
              <Share2 className="h-4 w-4" />
              공유하기
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="동행자 초대"
      className="flex flex-col gap-3 rounded-xl bg-surface-soft p-3"
    >
      <div>
        <p className="text-sm font-extrabold text-ink-heading">동행자 초대</p>
        <p className="mt-0.5 text-xs text-ink-caption">
          링크를 받은 동행자가 로그인하면 이 여행과 가계부를 함께 볼 수 있어요.
        </p>
      </div>

      <div>
        <button
          type="button"
          disabled={busyKey !== null}
          onClick={() => void createInvite(ALL_KEY)}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-brand px-4 text-sm font-bold text-surface-white disabled:opacity-60"
        >
          <Link2 className="h-4 w-4" />
          {busyKey === ALL_KEY
            ? "만드는 중…"
            : links[ALL_KEY]
              ? "새 초대 링크 만들기"
              : "동행자 초대"}
        </button>
        {links[ALL_KEY] ? (
          <>
            {renderLink(ALL_KEY, "동행자")}
            <p className="mt-2 text-[11px] text-ink-muted">
              이 링크는 {DEFAULT_TTL_HOURS}시간 동안, 최대 {DEFAULT_MAX_USES}명까지
              쓸 수 있어요.
            </p>
          </>
        ) : null}
      </div>

      {claimable.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
          <p className="text-xs font-semibold text-ink-caption">
            이름만 적어 둔 동행자는 이름에 맞는 링크를 따로 보내요
          </p>
          <ul className="flex flex-col gap-2">
            {claimable.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => void createInvite(m.id, m.id)}
                  className="inline-flex min-h-11 items-center rounded-xl border border-brand px-3 text-xs font-bold text-brand disabled:opacity-60"
                >
                  {busyKey === m.id
                    ? "만드는 중…"
                    : `${m.displayName}에게 초대 링크`}
                </button>
                {links[m.id] ? (
                  <>
                    {renderLink(m.id, m.displayName)}
                    <p className="mt-2 text-[11px] text-ink-muted">
                      이 링크는 {DEFAULT_TTL_HOURS}시간 동안, 1번만 쓸 수 있어요.
                    </p>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
