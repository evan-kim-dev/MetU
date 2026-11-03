"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ds/EmptyState";

type Props = {
  tripId: string;
  onBack: () => void;
};

/** 가계부에서 칩 제외·내가냈어요(K14)로 이어가요. */
export function GuestAdjust({ tripId, onBack }: Props) {
  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <EmptyState
        icon={MessageCircle}
        title="틀린 게 있으면 알려 주세요"
        body="가계부에서 멤버 칩으로 제외하거나, 「내가 냈어요」로 지출을 제안할 수 있어요."
        action={
          <div className="flex flex-col items-center gap-2">
            <Link
              href={`/trips/${tripId}/ledger?step=record`}
              className="mu-focus inline-flex min-h-[44px] items-center rounded-xl bg-mu-accent px-4 text-sm font-bold text-white"
            >
              가계부에서 조정하기
            </Link>
            <button
              type="button"
              className="mu-focus min-h-[44px] text-mu-label text-mu-accent"
              onClick={onBack}
            >
              내 몫으로
            </button>
          </div>
        }
      />
    </div>
  );
}
