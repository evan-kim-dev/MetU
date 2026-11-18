import Link from "next/link";
import { Camera, PencilLine } from "lucide-react";

const BASE =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent focus-visible:ring-offset-2";

/** 영수증 촬영(채운 CTA, 이 화면에서 유일) + 직접 추가. 여행 가계부의 ?add= 로 이동만 해요. */
export function PrimaryActions({ tripId }: { tripId: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        href={`/trips/${tripId}/ledger?add=receipt`}
        className={`${BASE} bg-mu-accent text-mu-on-accent`}
      >
        <Camera className="h-5 w-5" aria-hidden />
        영수증 촬영
      </Link>
      <Link
        href={`/trips/${tripId}/ledger?add=manual`}
        className={`${BASE} bg-mu-card text-mu-fg border border-mu-line`}
      >
        <PencilLine className="h-5 w-5" aria-hidden />
        직접 추가
      </Link>
    </div>
  );
}
