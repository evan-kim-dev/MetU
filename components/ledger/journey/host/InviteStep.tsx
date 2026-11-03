"use client";

import { Check, Clock, Copy, Crown, Link2, Share2, UserCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ds/Button";
import { useOptionalToast } from "@/components/ds/Toast";
import {
  ALL_KEY,
  MAX_USE_OPTIONS,
  TTL_OPTIONS,
  useTripInvite,
} from "@/components/trips/ledger/useTripInvite";
import { listMembers } from "@/lib/ledger/supabase";
import type { TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/** 참여 확인 폴링 간격. 화면이 보일 때만 돌아요. */
const MEMBER_POLL_MS = 5000;

type Props = {
  tripId: string;
  members: TripMember[];
  /** 소유자만 true. false 면 초대 도구 없이 참여 현황만 보여요. */
  canInvite: boolean;
  /** 폴링으로 멤버가 바뀌면 부모 상태를 맞춰요. */
  onMembersChanged?: (members: TripMember[]) => void;
};

const CARD = "rounded-mu-lg border border-mu-line bg-mu-card p-4";
const SELECT =
  "mu-focus min-h-tap rounded-mu-md border border-mu-line-strong bg-mu-card px-2 text-mu-body text-mu-fg";

function joinedIds(list: TripMember[]): Set<string> {
  return new Set(list.filter((m) => m.userId).map((m) => m.id));
}

/** 호스트 ② 초대 단계: 링크·QR·공유 + 참여 현황(실시간). */
export function InviteStep({ tripId, members, canInvite, onMembersChanged }: Props) {
  const invite = useTripInvite(tripId);
  const toast = useOptionalToast();
  const [current, setCurrent] = useState<TripMember[]>(members);
  const joinedRef = useRef<Set<string>>(joinedIds(members));
  const onChangedRef = useRef(onMembersChanged);
  const toastRef = useRef(toast);
  onChangedRef.current = onMembersChanged;
  toastRef.current = toast;

  useEffect(() => {
    setCurrent(members);
    joinedRef.current = joinedIds(members);
  }, [members]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const next = await listMembers(supabase, tripId);
      if (cancelled || next.length === 0) return;
      const before = joinedRef.current;
      const newcomers = next.filter((m) => m.userId && !before.has(m.id) && !m.isOwner);
      joinedRef.current = joinedIds(next);
      setCurrent(next);
      if (newcomers.length > 0) {
        onChangedRef.current?.(next);
        for (const m of newcomers) {
          toastRef.current?.show({ text: `${m.displayName}님이 들어왔어요`, tone: "ok" });
        }
      }
    };
    const timer = window.setInterval(() => void tick(), MEMBER_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tripId]);

  const claimable = current.filter((m) => !m.userId && !m.isOwner);
  const joinedCount = current.filter((m) => m.userId).length;

  async function share(key: string, who: string) {
    if (typeof navigator.share === "function") {
      await invite.shareLink(key, who);
      return;
    }
    const ok = await invite.copyLink(key);
    if (ok) {
      toast?.show({ text: "링크를 복사했어요. 메신저에 붙여 넣어 보내 주세요." });
    }
  }

  function renderLink(key: string, who: string) {
    const url = invite.links[key];
    if (!url) return null;
    const qr = invite.qrByKey[key];
    const copied = invite.copiedKey === key;
    return (
      <div className="mt-3 flex flex-col gap-3">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt={`${who} 초대 QR`}
            className="mx-auto h-40 w-40 rounded-mu-md border border-mu-line bg-mu-card p-2"
          />
        ) : (
          <div
            className="mx-auto h-40 w-40 animate-pulse rounded-mu-md bg-mu-sunken"
            aria-hidden
          />
        )}
        <input
          readOnly
          aria-label={`${who} 초대 링크`}
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-full rounded-mu-md border border-mu-line-strong bg-mu-card px-3 text-mu-caption text-mu-fg-2"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => void invite.copyLink(key)}>
            {copied ? (
              <Check className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            ) : (
              <Copy className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            )}
            {copied ? "복사했어요" : "링크 복사"}
          </Button>
          <Button variant="ghost" onClick={() => void share(key, who)}>
            <Share2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            공유하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {canInvite ? (
        <section aria-labelledby="invite-title" className={CARD}>
          <h2 id="invite-title" className="text-mu-heading text-mu-fg">
            동행자를 초대해요
          </h2>
          <p className="mt-1 text-mu-body text-mu-fg-2">
            QR을 보여 주거나 링크를 보내면, 가입 없이 이름만으로 들어와요.
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-mu-caption text-mu-fg-3">
              유효 시간
              <select
                className={SELECT}
                value={invite.ttlHours}
                onChange={(e) => invite.setTtlHours(Number(e.target.value))}
              >
                {TTL_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}시간
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-mu-caption text-mu-fg-3">
              최대 인원
              <select
                className={SELECT}
                value={invite.maxUses}
                onChange={(e) => invite.setMaxUses(Number(e.target.value))}
              >
                {MAX_USE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}명
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Button
            className="mt-3 w-full"
            variant={invite.links[ALL_KEY] ? "secondary" : "primary"}
            loading={invite.busyKey === ALL_KEY}
            disabled={invite.busyKey !== null}
            onClick={() => void invite.createInvite(ALL_KEY)}
          >
            <Link2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            {invite.busyKey === ALL_KEY
              ? "만드는 중…"
              : invite.links[ALL_KEY]
                ? "새 초대 링크 만들기"
                : "초대 링크 만들기"}
          </Button>
          {invite.links[ALL_KEY] ? (
            <>
              {renderLink(ALL_KEY, "동행자")}
              <p className="mt-2 text-mu-caption text-mu-fg-3">
                이 링크는 {invite.ttlHours}시간 동안, 최대 {invite.maxUses}명까지 쓸 수 있어요.
              </p>
            </>
          ) : null}

          {claimable.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-mu-line pt-4">
              <p className="text-mu-label text-mu-fg-2">
                이름만 적어 둔 동행자는 이름에 맞는 링크를 따로 보내요
              </p>
              <ul className="flex flex-col gap-3">
                {claimable.map((m) => (
                  <li key={m.id}>
                    <Button
                      variant="secondary"
                      loading={invite.busyKey === m.id}
                      disabled={invite.busyKey !== null}
                      onClick={() => void invite.createInvite(m.id, m.id)}
                    >
                      {invite.busyKey === m.id
                        ? "만드는 중…"
                        : `${m.displayName}에게 초대 링크`}
                    </Button>
                    {invite.links[m.id] ? (
                      <>
                        {renderLink(m.id, m.displayName)}
                        <p className="mt-2 text-mu-caption text-mu-fg-3">
                          이 링크는 {invite.ttlHours}시간 동안, 1번만 쓸 수 있어요.
                        </p>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {invite.error ? (
            <p role="alert" className="mt-3 text-mu-label text-mu-err">
              {invite.error}
            </p>
          ) : null}
        </section>
      ) : (
        <p className="rounded-mu-lg bg-mu-sunken px-4 py-3 text-mu-body text-mu-fg-2">
          초대는 여행을 만든 호스트만 할 수 있어요.
        </p>
      )}

      <section aria-labelledby="members-title" className={CARD}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="members-title" className="text-mu-heading text-mu-fg">
            참여한 사람
          </h2>
          <span className="mu-num text-mu-label text-mu-fg-2">
            {joinedCount}/{current.length}명
          </span>
        </div>
        <ul className="mt-2 flex flex-col">
          {current.map((m) => {
            const Icon = m.isOwner ? Crown : m.userId ? UserCheck : Clock;
            const label = m.isOwner ? "호스트" : m.userId ? "참여 확인됨" : "초대 대기";
            return (
              <li
                key={m.id}
                className="flex min-h-tap items-center justify-between gap-3 border-b border-mu-line py-2 last:border-b-0"
              >
                <span className="min-w-0 truncate text-mu-body text-mu-fg">{m.displayName}</span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 text-mu-label ${
                    m.isOwner ? "text-mu-fg-2" : m.userId ? "text-mu-ok" : "text-mu-fg-3"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
