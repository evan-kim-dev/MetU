"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

type Props = {
  tripId: string;
};

/**
 * 게스트 ④ 완료. 요약 링크 + 홈 화면 추가(PWA) 안내.
 */
export function GuestDone({ tripId }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-10 text-center pb-28">
      <CheckCircle2
        className="h-12 w-12 text-mu-ok"
        strokeWidth={1.75}
        aria-hidden
      />
      <h2 className="text-mu-title text-mu-fg">정산이 끝났어요</h2>
      <p className="text-mu-body text-mu-fg-2">내 송금까지 모두 반영됐어요.</p>
      <Link
        href={`/trips/${tripId}/ledger/report`}
        className="mu-focus flex min-h-tap items-center text-mu-label text-mu-accent"
      >
        여행 요약 보기
      </Link>
      <p className="mt-4 max-w-xs text-mu-caption text-mu-fg-3">
        다음에 쓰기 편하게, 브라우저 메뉴에서 「홈 화면에 추가」를 눌러 보세요.
      </p>
    </div>
  );
}
