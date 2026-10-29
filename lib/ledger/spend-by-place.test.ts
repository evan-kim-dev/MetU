import { describe, expect, it } from "vitest";
import { spendByDay, spendByPlaceId } from "@/lib/ledger/spend-by-place";

describe("spendByPlaceId / spendByDay", () => {
  it("sums same place and skips missing placeId", () => {
    const map = spendByPlaceId([
      { placeId: "a", krwAmount: 10000 },
      { placeId: "a", krwAmount: 5000 },
      { krwAmount: 3000 },
      { placeId: "b", krwAmount: 2000 },
    ]);
    expect(map).toEqual({ a: 15000, b: 2000 });
  });

  it("groups by dayIndex", () => {
    expect(
      spendByDay([
        { dayIndex: 1, krwAmount: 100 },
        { dayIndex: 1, krwAmount: 50 },
        { dayIndex: 2, krwAmount: 20 },
        { krwAmount: 99 },
      ])
    ).toEqual({ 1: 150, 2: 20 });
  });

  it("empty → empty", () => {
    expect(spendByPlaceId([])).toEqual({});
    expect(spendByDay([])).toEqual({});
  });
});
