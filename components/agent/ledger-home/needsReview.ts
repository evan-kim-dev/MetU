import {
  agentEventReasonLine,
  unassignedNote,
} from "@/lib/agent/event-status";
import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";
import { formatOriginalAmount } from "@/lib/ledger/fx-display";
import {
  buildTripSuggest,
  matchTripForEvent,
  resolveTripDatesForReceivedAt,
  type TripSuggest,
} from "@/lib/onboarding/trip-match";
import { parseReceivedAtMs } from "@/lib/onboarding/trip-window";
import { formatKRW } from "@/lib/shared/format";
import type { Trip } from "@/lib/trips/types";

export type FeaturedReview = {
  event: AutomationStatusEvent;
  /** 미배정이고 이 여행에 붙일 수 있을 때만 값이 있다 */
  suggest: TripSuggest | null;
};

/** 수신함(AgentInbox)과 같은 순수 함수로 "어느 여행에 붙일까" 제안을 계산한다. */
function suggestFor(
  event: AutomationStatusEvent,
  activeTrips: Trip[],
  nowMs: number
): TripSuggest | null {
  const receivedAtMs = parseReceivedAtMs(null, event.createdAt);
  const candidates = activeTrips.map((t) => {
    const dates = resolveTripDatesForReceivedAt(
      { startDate: t.startDate, endDate: t.endDate, dateRange: t.dateRange },
      receivedAtMs
    );
    return {
      id: t.id,
      startDate: dates?.startDate ?? null,
      endDate: dates?.endDate ?? null,
      destination: t.destination,
      status: t.status,
    };
  });
  const match = matchTripForEvent({ receivedAtMs, nowMs, candidates });
  return buildTripSuggest(match, candidates);
}

/**
 * 카드에 보여 줄 알림 1건. 최근 알림(최신순) 중 확인이 필요한 것만 본다.
 * 1순위: 이 여행에 붙일 수 있는 미배정 / 2순위: 가장 최근 확인 필요 알림.
 */
export function pickFeaturedReview(args: {
  events: AutomationStatusEvent[];
  tripId: string;
  activeTrips: Trip[];
  nowMs?: number;
}): FeaturedReview | null {
  const nowMs = args.nowMs ?? Date.now();
  const relevant = args.events.filter(
    (e) =>
      !e.isTest &&
      (e.status === "unassigned" ||
        (e.tripId === args.tripId &&
          (e.status === "needs_review" || e.status === "failed")))
  );
  let fallback: FeaturedReview | null = null;
  for (const event of relevant) {
    if (event.status !== "unassigned") {
      fallback ??= { event, suggest: null };
      continue;
    }
    const suggest = suggestFor(event, args.activeTrips, nowMs);
    if (suggest && suggest.tripId === args.tripId) return { event, suggest };
    fallback ??= { event, suggest: null };
  }
  return fallback;
}

/** 가맹점·금액 한 줄. 미리보기가 없으면 문자 앞부분, 그것도 없으면 일반 문구. */
export function reviewSummaryLine(event: AutomationStatusEvent): string {
  const p = event.preview;
  if (p && (p.merchant || p.amount != null)) {
    const parts: string[] = [p.merchant?.trim() || "가맹점 미상"];
    if (p.amount != null) {
      const cur = p.currency?.trim().toUpperCase();
      parts.push(
        !cur || cur === "KRW"
          ? formatKRW(p.amount)
          : formatOriginalAmount(p.amount, cur)
      );
    }
    return parts.join(" · ");
  }
  return event.textPreview.trim() || "자동 수집 알림";
}

/** 사유 한 줄 (event-status 의 사유 표 재사용). */
export function reviewReasonLine(review: FeaturedReview): string | null {
  const { event, suggest } = review;
  if (event.status === "unassigned") {
    return unassignedNote({
      hasTrips: true,
      reason: event.reason,
      suggest,
    }).message;
  }
  return agentEventReasonLine({
    status: event.status,
    reason: event.reason,
    error: event.error,
    isTest: event.isTest,
  });
}
