import { describe, expect, it } from "vitest";
import { buildDisplayAllocation } from "./display-allocation";

describe("buildDisplayAllocation", () => {
  it("비율 합이 100이고 금액은 총액 기준이에요", () => {
    const segs = buildDisplayAllocation(1_000_000);
    const pct = segs.reduce((s, x) => s + x.percent, 0);
    expect(pct).toBe(100);
    const sum = segs.reduce((s, x) => s + x.amount, 0);
    expect(sum).toBe(1_000_000);
  });

  it("0원이면 금액이 모두 0이에요", () => {
    const segs = buildDisplayAllocation(0);
    expect(segs.every((s) => s.amount === 0)).toBe(true);
  });
});
