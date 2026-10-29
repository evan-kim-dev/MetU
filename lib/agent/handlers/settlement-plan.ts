/**
 * Pure settlement automation planner (P18).
 * No DB — unit-tested decision table.
 */

export type TripPhase = "ongoing" | "ended";

export type SettlementAction =
  | "none"
  | "notify_preview_only"
  | "create_proposal"
  | "recreate_proposal"
  | "mark_stale"
  | "owner_nudge"
  | "hold_for_review";

export type OpenSettlementState = {
  basisHash: string;
  hasPaid: boolean;
  status: "open" | "stale" | "completed" | "superseded";
};

export type SettlementPlanState = {
  autoSettle: boolean;
  tripPhase: TripPhase;
  openSettlement: OpenSettlementState | null;
  currentBasisHash: string;
  pendingReviewCount: number;
  daysSinceEnd: number;
  lastRefreshAt: number | null;
  now: number;
  coalesceSec?: number;
  reviewHoldDays?: number;
};

export type SettlementPlanResult = {
  action: SettlementAction;
  reasons: string[];
};

function coalesceWindowPassed(
  lastRefreshAt: number | null,
  now: number,
  coalesceSec: number
): boolean {
  if (lastRefreshAt == null) return true;
  return now - lastRefreshAt >= coalesceSec * 1000;
}

/**
 * Decide what settlement automation should do.
 * Never marks transfers paid/received — proposals only.
 */
export function planSettlementAction(
  state: SettlementPlanState
): SettlementPlanResult {
  const coalesceSec = state.coalesceSec ?? 300;
  const reviewHoldDays = state.reviewHoldDays ?? 3;
  const reasons: string[] = [];

  const open =
    state.openSettlement &&
    (state.openSettlement.status === "open" ||
      state.openSettlement.status === "stale")
      ? state.openSettlement
      : null;

  const basisChanged = open
    ? open.basisHash !== state.currentBasisHash
    : false;

  if (!state.autoSettle) {
    if (open && basisChanged) {
      reasons.push("auto_settle_off_but_basis_changed");
      return { action: "mark_stale", reasons };
    }
    if (state.tripPhase === "ended" && !open) {
      reasons.push("auto_settle_off_trip_ended");
      return { action: "owner_nudge", reasons };
    }
    reasons.push("auto_settle_off");
    return { action: "none", reasons };
  }

  if (state.tripPhase === "ongoing") {
    if (open && basisChanged && open.hasPaid) {
      reasons.push("ongoing_paid_basis_changed");
      return { action: "mark_stale", reasons };
    }
    reasons.push("ongoing_preview_only");
    return { action: "notify_preview_only", reasons };
  }

  // ended
  if (!open) {
    if (
      state.pendingReviewCount > 0 &&
      state.daysSinceEnd < reviewHoldDays
    ) {
      reasons.push("hold_pending_review");
      return { action: "hold_for_review", reasons };
    }
    reasons.push("create_ended_proposal");
    return { action: "create_proposal", reasons };
  }

  if (!basisChanged) {
    reasons.push("basis_unchanged");
    return { action: "none", reasons };
  }

  if (open.hasPaid) {
    reasons.push("has_paid_cannot_recreate");
    return { action: "mark_stale", reasons };
  }

  if (!coalesceWindowPassed(state.lastRefreshAt, state.now, coalesceSec)) {
    reasons.push("coalesce_window");
    return { action: "none", reasons };
  }

  reasons.push("recreate_after_coalesce");
  return { action: "recreate_proposal", reasons };
}
