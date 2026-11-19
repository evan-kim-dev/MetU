import { describe, expect, it } from "vitest";
import { buildDisplayAllocation } from "./display-allocation";

describe("buildDisplayAllocation", () => {
  it("금액 합은 총액이고 비율은 약 100이에요", () => {
    const segs = buildDisplayAllocation(1_000_000);
    const pct = segs.reduce((s, x) => s + x.percent, 0);
    expect(pct).toBeGreaterThanOrEqual(98);
    expect(pct).toBeLessThanOrEqual(102);
    const sum = segs.reduce((s, x) => s + x.amount, 0);
    expect(sum).toBe(1_000_000);
  });

  it("0원이면 금액이 모두 0이에요", () => {
    const segs = buildDisplayAllocation(0);
    expect(segs.every((s) => s.amount === 0)).toBe(true);
  });
});
