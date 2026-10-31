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
  open: { label: "진행 중", tone: "bg-brand/10 text-brand" },
  stale: { label: "최신 아님", tone: "bg-amber-50 text-amber-900" },
  completed: { label: "완료", tone: "bg-mint/30 text-success" },
  superseded: { label: "이전 버전", tone: "bg-surface-soft text-ink-body" },
};

const BUTTON =
  "inline-flex min-h-tap items-center justify-center rounded-xl bg-surface-soft px-4 text-sm font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

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
      className="flex flex-col gap-3 rounded-2xl bg-surface-white p-4 shadow-soft ring-1 ring-line-soft"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-extrabold text-ink-heading">정산</h2>
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
          <p className="text-sm text-ink-body">
            보낼 돈{" "}
            <span className="font-bold tabular-nums text-ink-heading">
              {snap.transfers.length}건
            </span>{" "}
            · 총{" "}
            <span className="font-bold tabular-nums text-ink-heading">
              {formatKRW(snap.transfers.reduce((s, t) => s + t.krw, 0))}
            </span>
          </p>
          <Link href={settleHref} className={BUTTON}>
            정산 보기
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-body">
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
