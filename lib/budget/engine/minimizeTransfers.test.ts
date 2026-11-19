import { describe, expect, it } from "vitest";
import { minimizeTransfers, buildSettlement } from "./minimizeTransfers";

describe("minimizeTransfers", () => {
  it("잔액을 최소 송금으로 맞춰요", () => {
    const transfers = minimizeTransfers({
      a: 10_000,
      b: -6_000,
      c: -4_000,
    });
    const paid = transfers.reduce((s, t) => s + t.amount, 0);
    expect(paid).toBe(10_000);
    expect(transfers.every((t) => t.from && t.to && t.amount > 0)).toBe(true);
  });

  it("모두 0이면 빈 배열이에요", () => {
    expect(minimizeTransfers({ a: 0, b: 0 })).toEqual([]);
  });

  it("buildSettlement 에 tripId 를 붙여요", () => {
    const s = buildSettlement("trip-1", { a: 100, b: -100 });
    expect(s.tripId).toBe("trip-1");
    expect(s.transfers).toHaveLength(1);
    expect(s.transfers[0]!.amount).toBe(100);
  });
});
