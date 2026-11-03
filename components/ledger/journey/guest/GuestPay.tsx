"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { EmptyState } from "@/components/ds/EmptyState";

type Props = {
  tripId: string;
  hasTransfers: boolean;
};

export function GuestPay({ tripId, hasTransfers }: Props) {
  if (!hasTransfers) {
    return (
      <div className="px-4 py-6">
        <EmptyState
          icon={Wallet}
          title="먼저 정산을 계산해요"
          body="호스트가 정산을 만들면 여기서 송금할 수 있어요."
          action={
            <Link
              href={`/trips/${tripId}/ledger/settle`}
              className="mu-focus text-mu-label text-mu-accent"
            >
              정산 화면 보기
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6 pb-28">
      <p className="text-mu-body text-mu-fg-2">
        내가 보낼 송금은 정산 화면에서 확인하고, 송금 앱을 연 뒤 완료를
        눌러 주세요.
      </p>
      <BottomCTA
        label="정산에서 송금하기"
        onClick={() => {
          window.location.href = `/trips/${tripId}/ledger/settle`;
        }}
      />
    </div>
  );
}
