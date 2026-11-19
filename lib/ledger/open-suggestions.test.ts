import { describe, expect, it, vi } from "vitest";
import { fetchOpenBudgetSuggestions } from "@/lib/ledger/open-suggestions";

describe("fetchOpenBudgetSuggestions", () => {
  it("rebalance·settle open 행에 미리보기 필드를 채워요", async () => {
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
              payload: {
                message: "식비가 넘었어요",
                overCategories: ["food", "etc"],
                adjustmentsLog: ["점심: 2만원 → 8천원"],
              },
              created_at: "2026-11-20T00:00:00Z",
            },
            {
              id: "s2",
              type: "settle",
              payload: {
                transfers: [
                  { from: "a", to: "b", krw: 1000 },
                  { from: "c", to: "b", krw: 500 },
                ],
              },
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
      overLabels: ["식비", "관광·기타"],
      adjustmentsLog: ["점심: 2만원 → 8천원"],
    });
    expect(rows[1]).toMatchObject({
      type: "settle",
      transferCount: 2,
    });
    expect(rows[1]!.message).toContain("정산");
  });
});
