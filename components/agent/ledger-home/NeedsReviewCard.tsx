"use client";

import Link from "next/link";
import { useState } from "react";
import {
  reviewReasonLine,
  reviewSummaryLine,
  type FeaturedReview,
} from "./needsReview";

type Props = {
  /** 확인 필요 알림 전체 건수 (이 여행 처리 대기·실패·확인 필요 + 미배정) */
  count: number;
  featured: FeaturedReview | null;
  tripId: string;
  /** 붙이기에 성공한 뒤 목록을 다시 읽는다 */
  onAssigned: () => void;
};

const LINK =
  "inline-flex min-h-tap items-center rounded-xl px-1 text-sm font-bold text-mu-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent";

export function NeedsReviewCard({ count, featured, tripId, onAssigned }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (count <= 0) return null;

  const suggest = featured?.suggest ?? null;
  const reason = featured ? reviewReasonLine(featured) : null;
  const name = suggest?.destination?.trim() || "이 여행";

  async function assign() {
    if (!featured || !suggest || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/agent/events/${featured.event.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `assign-${res.status}`);
      }
      onAssigned();
    } catch (err) {
      console.error(
        "[NeedsReviewCard] assign",
        err instanceof Error ? err.message : err
      );
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="확인이 필요해요"
      className="flex flex-col gap-3 rounded-2xl bg-mu-card p-4 border border-mu-line"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-extrabold text-mu-fg">
          확인이 필요해요
        </h2>
        <span
          data-testid="needs-review-count"
          className="rounded-full bg-mu-err px-2 py-0.5 text-xs font-extrabold tabular-nums text-mu-on-accent"
        >
          {count}건
        </span>
      </div>

      {featured ? (
        <div className="flex flex-col gap-1">
          <p className="truncate text-sm font-bold text-mu-fg">
            {reviewSummaryLine(featured.event)}
          </p>
          {reason ? (
            <p className="line-clamp-2 text-xs text-mu-fg-2">{reason}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-mu-fg-2">
          확인함에서 확인할 알림이 있어요
        </p>
      )}

      {failed ? (
        <p role="alert" className="text-xs font-semibold text-mu-err">
          붙이지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3">
        {suggest ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void assign()}
            className="inline-flex min-h-tap items-center rounded-xl bg-mu-sunken px-4 text-sm font-bold text-mu-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent disabled:opacity-60"
          >
            {busy ? "붙이는 중…" : `${name} 여행에 붙이기`}
          </button>
        ) : null}
        <Link href="/agent/inbox" className={LINK}>
          확인함에서 정리하기
        </Link>
      </div>
    </section>
  );
}
