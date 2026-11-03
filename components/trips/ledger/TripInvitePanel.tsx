"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import type { TripMember } from "@/lib/ledger/types";
import {
  ALL_KEY,
  MAX_USE_OPTIONS,
  TTL_OPTIONS,
  useTripInvite,
} from "@/components/trips/ledger/useTripInvite";

interface TripInvitePanelProps {
  tripId: string;
  members: TripMember[];
  /** 소유자만 true. false 면 아무것도 그리지 않는다. */
  canInvite: boolean;
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
  const {
    links,
    qrByKey,
    busyKey,
    copiedKey,
    error,
    ttlHours,
    setTtlHours,
    maxUses,
    setMaxUses,
    createInvite,
    copyLink,
    shareLink,
  } = useTripInvite(tripId);

  if (!canInvite) return null;

  const claimable = members.filter((m) => !m.userId && !m.isOwner);

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
