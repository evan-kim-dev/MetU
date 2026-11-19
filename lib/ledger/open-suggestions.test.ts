import { describe, expect, it, vi } from "vitest";
import { fetchOpenBudgetSuggestions } from "@/lib/ledger/open-suggestions";

describe("fetchOpenBudgetSuggestions", () => {
  it("rebalance·settle open 행만 메시지와 함께 돌려줘요", async () => {
    const from = vi.fn(() => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: async () => ({
          data: [
            {
              id: "s1",
              type: "rebalance",
              payload: { message: "식비가 넘었어요" },
              created_at: "2026-11-20T00:00:00Z",
            },
            {
              id: "s2",
              type: "settle",
              payload: {},
              created_at: "2026-11-19T00:00:00Z",
            },
          ],
          error: null,
        }),
      };
      return chain;
    });

    const rows = await fetchOpenBudgetSuggestions({ from } as never, "t1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "s1",
      type: "rebalance",
      message: "식비가 넘었어요",
    });
    expect(rows[1]!.type).toBe("settle");
    expect(rows[1]!.message).toContain("정산");
  });
});
