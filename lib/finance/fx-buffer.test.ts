import { describe, expect, it } from "vitest";
import {
  DEMO_EXAMPLE_FX_FEES,
  calculateEffectiveFX,
  feesFromCardProfile,
} from "@/lib/finance/fx-buffer";

describe("calculateEffectiveFX", () => {
  it("수수료 미설정(기본 0)이면 기준 환율만 유지해요", () => {
    const result = calculateEffectiveFX({ baseRate: 910 });
    expect(result.markupPercent).toBe(0);
    expect(result.effectiveRate).toBe(910);
    expect(result.bufferAmount).toBe(0);
  });

  it("예시 2.5%를 명시하면 932.75원이에요", () => {
    const result = calculateEffectiveFX({
      baseRate: 910,
      ...DEMO_EXAMPLE_FX_FEES,
    });
    expect(result.markupPercent).toBe(2.5);
    expect(result.effectiveRate).toBe(932.75);
    expect(result.bufferAmount).toBe(22.75);
  });

  it("잘못된 기준 환율은 0으로 안전하게 돌려요", () => {
    expect(calculateEffectiveFX({ baseRate: 0 }).effectiveRate).toBe(0);
    expect(calculateEffectiveFX({ baseRate: -1 }).effectiveRate).toBe(0);
  });
});

describe("feesFromCardProfile", () => {
  it("fee_rate 를 cardFeeRate 로만 매핑해요", () => {
    expect(feesFromCardProfile(0.025)).toEqual({
      brandFeeRate: 0,
      cardFeeRate: 0.025,
      volatilityBuffer: 0,
    });
  });

  it("미설정·비정상은 0이에요", () => {
    expect(feesFromCardProfile(null)).toEqual({
      brandFeeRate: 0,
      cardFeeRate: 0,
      volatilityBuffer: 0,
    });
    expect(feesFromCardProfile(undefined)).toEqual({
      brandFeeRate: 0,
      cardFeeRate: 0,
      volatilityBuffer: 0,
    });
    expect(feesFromCardProfile(-1).cardFeeRate).toBe(0);
  });
});
