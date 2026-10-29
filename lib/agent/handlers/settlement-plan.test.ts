import { describe, expect, it } from "vitest";
import {
  planSettlementAction,
  type SettlementPlanState,
} from "@/lib/agent/handlers/settlement-plan";

const base = (over: Partial<SettlementPlanState> = {}): SettlementPlanState => ({
  autoSettle: true,
  tripPhase: "ended",
  openSettlement: null,
  currentBasisHash: "h1",
  pendingReviewCount: 0,
  daysSinceEnd: 1,
  lastRefreshAt: null,
  now: 1_000_000,
  coalesceSec: 300,
  reviewHoldDays: 3,
  ...over,
});

describe("planSettlementAction", () => {
  it("autoSettle off + ended + no open -> owner_nudge", () => {
    expect(planSettlementAction(base({ autoSettle: false })).action).toBe(
      "owner_nudge"
    );
  });

  it("autoSettle off + open basis change -> mark_stale", () => {
    expect(
      planSettlementAction(
        base({
          autoSettle: false,
          openSettlement: {
            basisHash: "old",
            hasPaid: false,
            status: "open",
          },
        })
      ).action
    ).toBe("mark_stale");
  });

  it("autoSettle off + ongoing -> none", () => {
    expect(
      planSettlementAction(
        base({ autoSettle: false, tripPhase: "ongoing" })
      ).action
    ).toBe("none");
  });

  it("ongoing -> notify_preview_only", () => {
    expect(planSettlementAction(base({ tripPhase: "ongoing" })).action).toBe(
      "notify_preview_only"
    );
  });

  it("ongoing + paid + basis change -> mark_stale", () => {
    expect(
      planSettlementAction(
        base({
          tripPhase: "ongoing",
          openSettlement: {
            basisHash: "old",
            hasPaid: true,
            status: "open",
          },
        })
      ).action
    ).toBe("mark_stale");
  });

  it("ended + no open + no review -> create_proposal", () => {
    expect(planSettlementAction(base()).action).toBe("create_proposal");
  });

  it("ended + pending review within hold -> hold_for_review", () => {
    expect(
      planSettlementAction(
        base({ pendingReviewCount: 2, daysSinceEnd: 1 })
      ).action
    ).toBe("hold_for_review");
  });

  it("ended + pending review after hold days -> create_proposal", () => {
    expect(
      planSettlementAction(
        base({ pendingReviewCount: 2, daysSinceEnd: 3 })
      ).action
    ).toBe("create_proposal");
  });

  it("open same basis -> none", () => {
    expect(
      planSettlementAction(
        base({
          openSettlement: {
            basisHash: "h1",
            hasPaid: false,
            status: "open",
          },
        })
      ).action
    ).toBe("none");
  });

  it("open different basis + unpaid + coalesce passed -> recreate", () => {
    expect(
      planSettlementAction(
        base({
          openSettlement: {
            basisHash: "old",
            hasPaid: false,
            status: "open",
          },
          lastRefreshAt: 1_000_000 - 301_000,
        })
      ).action
    ).toBe("recreate_proposal");
  });

  it("open different basis + unpaid + coalesce window -> none", () => {
    expect(
      planSettlementAction(
        base({
          openSettlement: {
            basisHash: "old",
            hasPaid: false,
            status: "open",
          },
          lastRefreshAt: 1_000_000 - 60_000,
        })
      ).action
    ).toBe("none");
  });

  it("open different basis + hasPaid -> mark_stale", () => {
    expect(
      planSettlementAction(
        base({
          openSettlement: {
            basisHash: "old",
            hasPaid: true,
            status: "open",
          },
        })
      ).action
    ).toBe("mark_stale");
  });

  it("stale open with same basis -> none", () => {
    expect(
      planSettlementAction(
        base({
          openSettlement: {
            basisHash: "h1",
            hasPaid: false,
            status: "stale",
          },
        })
      ).action
    ).toBe("none");
  });

  it("daysSinceEnd 0 + review hold -> hold", () => {
    expect(
      planSettlementAction(
        base({ pendingReviewCount: 1, daysSinceEnd: 0 })
      ).action
    ).toBe("hold_for_review");
  });

  it("coalesce boundary exactly coalesceSec -> recreate", () => {
    expect(
      planSettlementAction(
        base({
          openSettlement: {
            basisHash: "old",
            hasPaid: false,
            status: "open",
          },
          lastRefreshAt: 1_000_000 - 300_000,
        })
      ).action
    ).toBe("recreate_proposal");
  });

  it("voided-only basis change still recreate when hash differs", () => {
    expect(
      planSettlementAction(
        base({
          currentBasisHash: "h2",
          openSettlement: {
            basisHash: "h1",
            hasPaid: false,
            status: "open",
          },
          lastRefreshAt: null,
        })
      ).action
    ).toBe("recreate_proposal");
  });

  it("autoSettle off does not create_proposal", () => {
    const r = planSettlementAction(
      base({ autoSettle: false, tripPhase: "ended" })
    );
    expect(r.action).not.toBe("create_proposal");
    expect(r.action).not.toBe("recreate_proposal");
  });

  it("ongoing never create_proposal", () => {
    expect(
      planSettlementAction(
        base({ tripPhase: "ongoing", openSettlement: null })
      ).action
    ).not.toBe("create_proposal");
  });

  it("completed open treated as no open for recreate path", () => {
    // completed is not "open"/"stale" → treated as no open settlement
    expect(
      planSettlementAction(
        base({
          openSettlement: {
            basisHash: "old",
            hasPaid: false,
            status: "completed",
          },
        })
      ).action
    ).toBe("create_proposal");
  });

  it("superseded open treated as no open", () => {
    expect(
      planSettlementAction(
        base({
          openSettlement: {
            basisHash: "old",
            hasPaid: false,
            status: "superseded",
          },
        })
      ).action
    ).toBe("create_proposal");
  });
});
