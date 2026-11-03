"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

type Props = {
  tripId: string;
};

export function GuestDone({ tripId }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
      <CheckCircle2 className="h-12 w-12 text-mu-ok" aria-hidden />
      <h2 className="text-mu-heading font-bold text-mu-fg">정산이 끝났어요</h2>
      <p className="text-mu-body text-mu-fg-3">내 송금까지 모두 반영됐어요.</p>
      <Link
        href={`/trips/${tripId}/ledger/report`}
        className="mu-focus min-h-[44px] text-mu-label text-mu-accent"
      >
        여행 리캡 보기
      </Link>
    </div>
  );
}
