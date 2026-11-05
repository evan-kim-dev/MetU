import { describe, expect, it } from "vitest";
import { calculateEffectiveFX } from "@/lib/finance/fx-buffer";

describe("calculateEffectiveFX", () => {
  it("100엔당 910원 기준 마진 2.5% → 932.75원", () => {
    const result = calculateEffectiveFX({ baseRate: 910 });
    expect(result.markupPercent).toBe(2.5);
    expect(result.effectiveRate).toBe(932.75);
    expect(result.bufferAmount).toBe(22.75);
  });

  it("수수료를 0으로 넘기면 기준 환율만 유지해요", () => {
    const result = calculateEffectiveFX({
      baseRate: 910,
      brandFeeRate: 0,
      cardFeeRate: 0,
      volatilityBuffer: 0,
    });
    expect(result.effectiveRate).toBe(910);
    expect(result.markupPercent).toBe(0);
    expect(result.bufferAmount).toBe(0);
  });

  it("잘못된 기준 환율은 0으로 안전하게 돌려요", () => {
    expect(calculateEffectiveFX({ baseRate: 0 }).effectiveRate).toBe(0);
    expect(calculateEffectiveFX({ baseRate: -1 }).effectiveRate).toBe(0);
  });
});
