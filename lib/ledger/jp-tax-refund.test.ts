import { describe, expect, it } from "vitest";

import {
  EFFECTIVE_FROM,
  JP_TAX_REFUND_DISCLAIMER,
  JP_TAX_REFUND_SOURCE_URL,
  JP_TAX_REFUND_VERIFIED_ON,
  THRESHOLD_JPY_EXCL_TAX,
  groupStoreDays,
  type TaxFreeExpense,
} from "./jp-tax-refund";

function e(over: Partial<TaxFreeExpense> & { id: string }): TaxFreeExpense {
  return {
    merchant: "ユニクロ",
    spentOn: "2026-11-05",
    currency: "JPY",
    amount: 6000,
    taxFree: true,
    taxExclAmount: 5500,
    category: "쇼핑",
    ...over,
  };
}

describe("groupStoreDays", () => {
  it("same store·day sums to eligible at 5000", () => {
    const groups = groupStoreDays([
      e({ id: "1", taxExclAmount: 2000 }),
      e({ id: "2", taxExclAmount: 2000 }),
      e({ id: "3", taxExclAmount: 1000 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.status).toBe("eligible");
    expect(groups[0]?.taxExclSum).toBe(THRESHOLD_JPY_EXCL_TAX);
  });

  it("4999 is below_threshold with shortfall 1", () => {
    const g = groupStoreDays([e({ id: "1", taxExclAmount: 4999 })]);
    expect(g[0]?.status).toBe("below_threshold");
    expect(g[0]?.shortfall).toBe(1);
  });

  it("different days are not merged", () => {
    const g = groupStoreDays([
      e({ id: "1", spentOn: "2026-11-05", taxExclAmount: 3000 }),
      e({ id: "2", spentOn: "2026-11-06", taxExclAmount: 3000 }),
    ]);
    expect(g).toHaveLength(2);
  });

  it("missing tax excl → needs_amount", () => {
    const g = groupStoreDays([
      e({ id: "1", taxExclAmount: null }),
    ]);
    expect(g[0]?.status).toBe("needs_amount");
  });

  it("before effective → legacy", () => {
    const g = groupStoreDays([
      e({ id: "1", spentOn: "2026-10-31", taxExclAmount: 9000 }),
    ]);
    expect(g[0]?.status).toBe("legacy");
    expect(EFFECTIVE_FROM).toBe("2026-11-01");
  });

  it("food category → consumable_warning", () => {
    const g = groupStoreDays([
      e({ id: "1", category: "식비", taxExclAmount: 9000 }),
    ]);
    expect(g[0]?.status).toBe("consumable_warning");
  });

  it("deadline is spentOn+90 including month end", () => {
    const g = groupStoreDays([
      e({ id: "1", spentOn: "2026-01-31", taxExclAmount: 9000 }),
    ]);
    // legacy because before EFFECTIVE_FROM — still computes deadline
    expect(g[0]?.deadlineApprox).toBe("2026-05-01");
  });

  it("return type has no refund amount field", () => {
    const g = groupStoreDays([e({ id: "1" })]);
    expect(Object.keys(g[0] ?? {})).not.toContain("refundAmount");
    expect(Object.keys(g[0] ?? {})).not.toContain("refundKrw");
  });
});

describe("disclaimer copy", () => {
  it("exposes source url and verified date", () => {
    expect(JP_TAX_REFUND_SOURCE_URL).toContain("customs.go.jp");
    expect(JP_TAX_REFUND_VERIFIED_ON).toBe("2026-11-02");
    expect(JP_TAX_REFUND_DISCLAIMER).toContain("참고용");
  });
});
