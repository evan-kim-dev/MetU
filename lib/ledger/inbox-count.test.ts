import { describe, expect, it, vi } from "vitest";

import {
  fetchTripInboxCount,
  fetchUnassignedInboxCount,
  sumInboxCounts,
} from "@/lib/ledger/inbox-count";

describe("sumInboxCounts", () => {
  it("events + proposals + suggestions", () => {
    expect(sumInboxCounts(2, 3)).toBe(5);
    expect(sumInboxCounts(2, 3, 1)).toBe(6);
    expect(sumInboxCounts(null, 1)).toBe(1);
    expect(sumInboxCounts(undefined, undefined)).toBe(0);
  });
});

describe("fetchTripInboxCount", () => {
  it("sums events, proposals, and open rebalance/settle suggestions", async () => {
    const from = vi.fn((table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () =>
          Promise.resolve({
            count: table === "agent_events" ? 2 : 0,
          }),
      };
      if (table === "agent_events") return chain;
      const count =
        table === "trip_expense_proposals"
          ? 3
          : table === "trip_bot_proposals"
            ? 1
            : table === "trip_suggestions"
              ? 2
              : 0;
      const tail = {
        in: () => Promise.resolve({ count }),
        then: (
          resolve: (v: { count: number }) => unknown,
          reject?: (e: unknown) => unknown
        ) => Promise.resolve({ count }).then(resolve, reject),
      };
      return {
        select: () => ({
          eq: () => ({
            eq: () => tail,
          }),
        }),
      };
    });

    const n = await fetchTripInboxCount(
      { from } as never,
      { tripId: "t1", userId: "u1", includeProposals: true }
    );
    expect(n).toBe(8);
  });
});

describe("fetchUnassignedInboxCount", () => {
  it("returns unassigned event count", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ count: 7 }),
        }),
      }),
    }));
    const n = await fetchUnassignedInboxCount({ from } as never, "u1");
    expect(n).toBe(7);
  });
});
