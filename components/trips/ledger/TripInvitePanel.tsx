"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { TripMember } from "@/lib/ledger/types";
import { renderQrSvg, svgToDataUri } from "@/lib/onboarding/qr-svg";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/** K10 데모 기본: 24시간 · 4명 (RPC 허용 범위 안). */
const DEFAULT_TTL_HOURS = 24;
const DEFAULT_MAX_USES = 4;

const TTL_OPTIONS = [6, 24, 72] as const;
const MAX_USE_OPTIONS = [2, 4, 10] as const;

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
 * 동행자 초대 링크·QR (소유자 전용).
 * 토큰/QR 값은 화면 상태에만 두고 로그·분석·에러 메시지에 남기지 않아요.
 */
export function TripInvitePanel({
  tripId,
  members,
  canInvite,
}: TripInvitePanelProps) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [qrByKey, setQrByKey] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ttlHours, setTtlHours] = useState<number>(DEFAULT_TTL_HOURS);
  const [maxUses, setMaxUses] = useState<number>(DEFAULT_MAX_USES);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(links);
    if (entries.length === 0) return;
    void (async () => {
      for (const [key, url] of entries) {
        if (qrByKey[key]) continue;
        try {
          const svg = await renderQrSvg(url);
          if (cancelled) return;
          setQrByKey((prev) => ({ ...prev, [key]: svgToDataUri(svg) }));
        } catch (e) {
          console.error(
            "[invite] qr",
            e instanceof Error ? e.message : "qr-failed"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [links, qrByKey]);

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
              p_ttl_hours: ttlHours,
              p_max_uses: 1,
            }
          : {
              p_trip_id: tripId,
              p_ttl_hours: ttlHours,
              p_max_uses: maxUses,
            }
      );
      if (rpcError || typeof data !== "string" || data.length === 0) {
        console.error(
          "[invite] create_trip_invite",
          rpcError?.message ?? "empty"
        );
        setError("초대 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setLinks((prev) => ({ ...prev, [key]: inviteUrl(data) }));
      setQrByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
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
    const qr = qrByKey[key];
    return (
      <div className="mt-2 flex flex-col gap-2">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt={`${who} 초대 QR`}
            className="mx-auto h-40 w-40 rounded-xl border border-line-muted bg-surface-white p-2"
          />
        ) : (
          <div
            className="mx-auto h-40 w-40 animate-pulse rounded-xl bg-surface-white"
            aria-hidden
          />
        )}
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
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copiedKey === key ? "복사했어요" : "링크 복사"}
          </button>
          {canNativeShare ? (
            <button
              type="button"
              onClick={() => void shareLink(key, who)}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-brand px-3 text-xs font-bold text-brand"
            >
              <Share2 className="h-4 w-4" aria-hidden />
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
          QR을 보여 주거나 링크를 보내면, 가입 없이 이름만으로 합류할 수 있어요.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-caption">
          유효 시간
          <select
            className="min-h-tap rounded-xl border border-line-muted bg-surface-white px-2 text-sm text-ink-body"
            value={ttlHours}
            onChange={(e) => setTtlHours(Number(e.target.value))}
          >
            {TTL_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}시간
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-caption">
          최대 인원
          <select
            className="min-h-tap rounded-xl border border-line-muted bg-surface-white px-2 text-sm text-ink-body"
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
          >
            {MAX_USE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}명
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <button
          type="button"
          disabled={busyKey !== null}
          onClick={() => void createInvite(ALL_KEY)}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-brand px-4 text-sm font-bold text-surface-white disabled:opacity-60"
        >
          <Link2 className="h-4 w-4" aria-hidden />
          {busyKey === ALL_KEY
            ? "만드는 중…"
            : links[ALL_KEY]
              ? "새 초대 링크 만들기"
              : "동행자 초대"}
        </button>
        {links[ALL_KEY] ? (
          <>
            {renderLink(ALL_KEY, "동행자")}
            <p className="mt-2 text-xs text-ink-muted">
              이 링크는 {ttlHours}시간 동안, 최대 {maxUses}명까지 쓸 수 있어요.
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
                    <p className="mt-2 text-xs text-ink-muted">
                      이 링크는 {ttlHours}시간 동안, 1번만 쓸 수 있어요.
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
