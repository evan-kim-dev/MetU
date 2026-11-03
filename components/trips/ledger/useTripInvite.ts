"use client";

import { useEffect, useState } from "react";
import { renderQrSvg, svgToDataUri } from "@/lib/onboarding/qr-svg";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/** K10 데모 기본: 24시간 · 4명 (RPC 허용 범위 안). */
export const DEFAULT_TTL_HOURS = 24;
export const DEFAULT_MAX_USES = 4;

export const TTL_OPTIONS = [6, 24, 72] as const;
export const MAX_USE_OPTIONS = [2, 4, 10] as const;

/** 여행 전체 초대 링크 키. 그 밖의 키는 이름만 적어 둔 멤버 id. */
export const ALL_KEY = "__all__";

function inviteUrl(token: string): string {
  return `${window.location.origin}/join/${token}`;
}

/**
 * 초대 링크 만들기·QR·복사·공유 상태. TripInvitePanel 과 가계부 초대 단계가 함께 써요.
 * 토큰/QR 값은 화면 상태에만 두고 로그·분석·에러 메시지에 남기지 않아요.
 */
export function useTripInvite(tripId: string) {
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

  /** 복사에 성공하면 true. */
  async function copyLink(key: string): Promise<boolean> {
    const url = links[key];
    if (!url) return false;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
      return true;
    } catch {
      setError("링크를 복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.");
      return false;
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

  return {
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
  };
}
