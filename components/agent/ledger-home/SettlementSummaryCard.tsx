"use client";

import Link from "next/link";
import { SkeletonBlock } from "@/components/ui/PageSkeleton";
import type {
  SettlementSnapshot,
  SettlementStatus,
} from "@/lib/ledger/supabase";
import { formatKRW } from "@/lib/shared/format";
import { SectionRetry } from "./SectionRetry";
import type { SectionState } from "./useLedgerHomeData";

type Props = {
  tripId: string;
  settlement: SectionState<SettlementSnapshot | null>;
  expenseCount: number;
  memberCount: number;
  onRetry: () => void;
};

const CHIP: Record<SettlementStatus, { label: string; tone: string }> = {
  open: { label: "진행 중", tone: "bg-mu-accent-soft text-mu-accent" },
  stale: { label: "최신 아님", tone: "bg-mu-warn-soft text-mu-warn" },
  completed: { label: "완료", tone: "bg-mu-ok-soft text-mu-ok" },
  superseded: { label: "이전 버전", tone: "bg-mu-sunken text-mu-fg-2" },
};

const BUTTON =
  "inline-flex min-h-tap items-center justify-center rounded-xl bg-mu-sunken px-4 text-sm font-bold text-mu-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent";

/** 저장된 송금 개수·합만 보여 줘요. 정산 계산·생성은 정산 화면에서만 해요. */
export function SettlementSummaryCard({
  tripId,
  settlement,
  expenseCount,
  memberCount,
  onRetry,
}: Props) {
  const snap = settlement.data;
  const settleHref = `/trips/${tripId}/ledger/settle`;
  const canStart = expenseCount >= 2 && memberCount >= 2;

  return (
    <section
      aria-label="정산 요약"
      className="flex flex-col gap-3 rounded-2xl bg-mu-card p-4 border border-mu-line"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-extrabold text-mu-fg">정산</h2>
        {snap ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[snap.status].tone}`}
          >
            {CHIP[snap.status].label}
          </span>
        ) : null}
      </div>

      {settlement.status === "loading" ? (
        <SkeletonBlock className="h-10 w-full" />
      ) : settlement.status === "error" ? (
        <SectionRetry onRetry={onRetry} />
      ) : snap ? (
        <>
          <p className="text-sm text-mu-fg-2">
            보낼 돈{" "}
            <span className="font-bold tabular-nums text-mu-fg">
              {snap.transfers.length}건
            </span>{" "}
            · 총{" "}
            <span className="font-bold tabular-nums text-mu-fg">
              {formatKRW(snap.transfers.reduce((s, t) => s + t.krw, 0))}
            </span>
          </p>
          <Link href={settleHref} className={BUTTON}>
            정산 보기
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-mu-fg-2">
            정산할 내역이 생기면 여기서 보여줘요
          </p>
          {canStart ? (
            <Link href={settleHref} className={BUTTON}>
              정산하기
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}
