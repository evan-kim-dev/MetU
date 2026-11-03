"use client";

import Link from "next/link";
import { Hourglass } from "lucide-react";
import { AmountCard } from "@/components/ds/AmountCard";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { EmptyState } from "@/components/ds/EmptyState";

type Props = {
  tripId: string;
  myShareKrw: number | null;
  settlementReady: boolean;
  onGoPay: () => void;
  onGoAdjust: () => void;
  onRefresh: () => void;
};

export function GuestShare({
  tripId,
  myShareKrw,
  settlementReady,
  onGoPay,
  onGoAdjust,
  onRefresh,
}: Props) {
  if (!settlementReady || myShareKrw == null) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <EmptyState
          icon={Hourglass}
          title="호스트가 정산을 계산하면 알려줘요"
          body="잠시 뒤 새로고침해 주세요."
          action={
            <button
              type="button"
              className="mu-focus min-h-[44px] text-mu-label text-mu-accent"
              onClick={onRefresh}
            >
              새로고침
            </button>
          }
        />
        <button
          type="button"
          className="mu-focus min-h-[44px] text-center text-mu-label text-mu-fg-3"
          onClick={onGoAdjust}
        >
          틀린 게 있어요
        </button>
      </div>
    );
  }

  const owe = myShareKrw < 0;
  return (
    <div className="flex flex-col gap-4 px-4 py-6 pb-28">
      <AmountCard
        label={owe ? "보낼 돈" : myShareKrw > 0 ? "받을 돈" : "내 몫"}
        amount={Math.abs(myShareKrw)}
        tone={owe ? "accent" : myShareKrw > 0 ? "ok" : "neutral"}
        action={
          <Link
            href={`/trips/${tripId}/ledger/settle`}
            className="text-mu-label text-mu-accent"
          >
            왜 이 금액?
          </Link>
        }
      />
      <button
        type="button"
        className="mu-focus min-h-[44px] text-center text-mu-label text-mu-fg-3"
        onClick={onGoAdjust}
      >
        틀린 게 있어요
      </button>
      {owe ? (
        <BottomCTA label="송금하러 가기" onClick={onGoPay} />
      ) : null}
    </div>
  );
}
