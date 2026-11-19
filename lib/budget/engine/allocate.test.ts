import { describe, expect, it } from "vitest";
import { allocate, baseAllocateWeights, planToSegments } from "./allocate";

describe("allocate", () => {
  it("카테고리 한도 합이 total과 같아요", () => {
    const plan = allocate({
      total: 1_000_000,
      travelers: 2,
      nights: 3,
      destination: "오사카",
    });
    const sum = Object.values(plan.categories).reduce((s, c) => s + c.limit, 0);
    expect(sum).toBe(1_000_000);
    expect(plan.total).toBe(1_000_000);
    expect(plan.perPerson).toBe(500_000);
    expect(plan.version).toBe(1);
  });

  it("0원이면 모두 0이에요", () => {
    const plan = allocate({ total: 0, travelers: 2, nights: 2 });
    expect(Object.values(plan.categories).every((c) => c.limit === 0)).toBe(
      true
    );
  });

  it("국내 목적지는 항공 비중이 해외보다 낮아요", () => {
    const domestic = baseAllocateWeights({
      travelers: 2,
      nights: 3,
      destination: "제주",
    });
    const overseas = baseAllocateWeights({
      travelers: 2,
      nights: 3,
      destination: "도쿄",
    });
    expect(domestic.flight).toBeLessThan(overseas.flight);
  });

  it("planToSegments percent 합은 대략 100이에요", () => {
    const plan = allocate({ total: 1_000_000, travelers: 2, nights: 3 });
    const segs = planToSegments(plan);
    const pct = segs.reduce((s, x) => s + x.percent, 0);
    expect(pct).toBeGreaterThanOrEqual(98);
    expect(pct).toBeLessThanOrEqual(102);
  });
});
