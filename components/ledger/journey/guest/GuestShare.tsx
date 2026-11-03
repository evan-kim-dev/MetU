"use client";

import Link from "next/link";
import { MyShareCard } from "@/components/ledger/MyShareCard";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { resolveMyShare } from "@/lib/ledger/my-share";

type Props = {
  tripId: string;
  /** 현재 지출 기준 순잔액(+받을 / -보낼). null이면 아직 모름 */
  myShareKrw: number | null;
  settlementReady: boolean;
  stale: boolean;
  onGoPay: () => void;
  onGoAdjust: () => void;
  onRefresh: () => void;
};

export function GuestShare({
  tripId,
  myShareKrw,
  settlementReady,
  stale,
  onGoPay,
  onGoAdjust,
  onRefresh,
}: Props) {
  const view = resolveMyShare({
    liveBalance: myShareKrw,
    hasSettlement: settlementReady,
    stale,
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-6 pb-28">
      <MyShareCard
        view={view}
        action={
          <Link
            href={`/trips/${tripId}/ledger/settle`}
            className="text-mu-label text-mu-accent"
          >
            왜 이 금액?
          </Link>
        }
      />
      <div className="flex flex-col items-stretch gap-2">
        <button
          type="button"
          className="mu-focus min-h-[44px] text-center text-mu-label text-mu-fg-3"
          onClick={onRefresh}
        >
          새로고침
        </button>
        <button
          type="button"
          className="mu-focus min-h-[44px] text-center text-mu-label text-mu-fg-3"
          onClick={onGoAdjust}
        >
          틀린 게 있어요
        </button>
      </div>
      {view.showPayActions ? (
        <BottomCTA label="송금하러 가기" onClick={onGoPay} />
      ) : null}
    </div>
  );
}
