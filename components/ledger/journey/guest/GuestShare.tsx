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

/**
 * 게스트 ① 내 몫. 히어로 금액 + 왜 이 금액? + CTA(송금/분담 확인).
 */
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
    <div className="flex flex-col gap-6 px-4 py-6 pb-28">
      <div>
        <h2 className="text-mu-title text-mu-fg">내 몫이에요</h2>
        <p className="mt-1 text-mu-body text-mu-fg-2">
          호스트가 기록한 지출을 기준으로 계산했어요. 틀리면 아래에서 고쳐
          주세요.
        </p>
      </div>

      <MyShareCard
        view={view}
        action={
          <Link
            href={`/trips/${tripId}/ledger/settle`}
            className="min-h-tap text-mu-label text-mu-accent"
          >
            왜 이 금액?
          </Link>
        }
      />

      <div className="flex flex-col items-stretch gap-2">
        <button
          type="button"
          className="mu-focus min-h-tap text-center text-mu-label text-mu-fg-3"
          onClick={onRefresh}
        >
          새로고침
        </button>
        <button
          type="button"
          className="mu-focus min-h-tap text-center text-mu-label text-mu-fg-3"
          onClick={onGoAdjust}
        >
          틀린 게 있어요
        </button>
      </div>

      {view.showPayActions ? (
        <BottomCTA label="송금하러 가기" onClick={onGoPay} />
      ) : (
        <BottomCTA
          label="내 분담 확인하기"
          onClick={onGoAdjust}
          hint={
            settlementReady
              ? "보낼 돈이 없으면 분담만 확인해 주세요"
              : "호스트가 정산을 만들면 송금할 수 있어요"
          }
        />
      )}
    </div>
  );
}
