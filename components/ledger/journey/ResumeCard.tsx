"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AutomationUiState } from "@/lib/onboarding/automation-ui-state";
import {
  automationToJourneyInput,
  deriveJourney,
  formatResumeHeadline,
  type JourneyRole,
  type JourneySettlement,
} from "@/lib/ledger/journey-state";
import type { SettlementSnapshot } from "@/lib/ledger/supabase";
import { Skeleton } from "@/components/ds/Skeleton";

export type ResumeCardProps = {
  tripId: string;
  role?: JourneyRole;
  /** 자동화 알약 상태. null 이면 unknown */
  automationUi: AutomationUiState | null;
  memberCount: number | null;
  expenseCount: number | null;
  pendingReviewCount: number | null;
  /** 제안 건수. 아직 홈 데이터에 없으면 0 */
  pendingProposalCount?: number;
  settlement: SettlementSnapshot | null | undefined;
  /** 섹션 로딩 중이면 스켈레톤 */
  loading?: boolean;
};

function toJourneySettlement(
  snap: SettlementSnapshot | null | undefined
): JourneySettlement | null {
  if (!snap) return null;
  const transfersTotal = snap.transfers.length;
  const transfersPaid = snap.transfers.filter((t) => t.status === "paid").length;
  return {
    status: snap.status,
    transfersTotal,
    transfersPaid,
  };
}

/**
 * /agent 가계부 홈 "이어서 하기".
 * 링크는 `?step=` 없이 `/trips/[id]/ledger` — TripJourney 가 deriveJourney 기본 단계로 열어요.
 */
export function ResumeCard({
  tripId,
  role = "host",
  automationUi,
  memberCount,
  expenseCount,
  pendingReviewCount,
  pendingProposalCount = 0,
  settlement,
  loading = false,
}: ResumeCardProps) {
  if (loading || memberCount == null || expenseCount == null || pendingReviewCount == null) {
    return (
      <section
        data-testid="resume-card"
        aria-label="지금 할 일"
        aria-busy="true"
        className="rounded-2xl border border-mu-line bg-mu-card p-4"
      >
        <Skeleton h={14} w={96} />
        <div className="mt-3">
          <Skeleton h={24} w="75%" />
        </div>
        <div className="mt-4">
          <Skeleton h={52} w="100%" rounded="lg" />
        </div>
      </section>
    );
  }

  const journey = deriveJourney({
    role,
    automation: automationToJourneyInput(automationUi),
    memberCount,
    expenseCount,
    pendingReviewCount,
    pendingProposalCount,
    settlement: toJourneySettlement(settlement),
  });
  const headline = formatResumeHeadline(role, journey);
  const href = `/trips/${tripId}/ledger`;
  const cta = role === "guest" ? "내 몫 보기" : "이어서 하기";

  return (
    <section
      data-testid="resume-card"
      aria-label="지금 할 일"
      className="flex flex-col gap-3 rounded-2xl border border-mu-line bg-mu-card p-4"
    >
      <div>
        <p className="text-mu-caption font-semibold text-mu-fg-3">지금 할 일</p>
        <p className="mt-1 text-mu-heading text-mu-fg">{headline}</p>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-1 rounded-xl bg-mu-accent px-4 text-sm font-extrabold text-mu-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent"
      >
        {cta}
        <ChevronRight className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </Link>
    </section>
  );
}
