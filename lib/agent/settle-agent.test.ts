import { describe, expect, it } from "vitest";
import {
  buildSettleProposal,
  transfersForRpc,
} from "@/lib/agent/settle-agent";

describe("buildSettleProposal", () => {
  it("잔액이 있으면 Suggestion 초안을 만들어요", () => {
    const r = buildSettleProposal({
      tripId: "t1",
      balances: { a: 10_000, b: -10_000 },
    });
    expect(r.shouldSuggest).toBe(true);
    expect(r.settlement.transfers).toEqual([
      { from: "b", to: "a", amount: 10_000 },
    ]);
    expect(transfersForRpc(r.settlement.transfers)).toEqual([
      { from: "b", to: "a", krw: 10_000 },
    ]);
  });

  it("잔액이 없으면 Suggestion 안 만들어요", () => {
    const r = buildSettleProposal({
      tripId: "t1",
      balances: { a: 0, b: 0 },
    });
    expect(r.shouldSuggest).toBe(false);
    expect(r.settlement.transfers).toEqual([]);
  });
});
