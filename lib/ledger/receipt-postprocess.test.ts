import { describe, expect, it } from "vitest";
import { postprocessReceiptExtract } from "@/lib/ledger/receipt-postprocess";
import type { ReceiptOut } from "@/lib/ai/contracts";

function baseExtract(overrides: Partial<ReceiptOut> = {}): ReceiptOut {
  return {
    isReceipt: true,
    merchant: "Lawson",
    merchantKo: "로손",
    paidAt: "2026-03-01T18:30",
    currency: "JPY",
    total: 1000,
    subtotal: 909,
    tax: 91,
    tip: null,
    items: [
      {
        name: "Onigiri",
        nameKo: "주먹밥",
        qty: 2,
        unitPrice: 200,
        amount: 400,
      },
    ],
    category: "식비",
    paymentMethod: "card",
    language: "ja",
    confidence: 0.9,
    warnings: [],
    ...overrides,
  };
}

describe("postprocessReceiptExtract", () => {
  it("warns when item sum differs from total by more than 2%", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({
        total: 1000,
        items: [
          {
            name: "A",
            nameKo: null,
            qty: 1,
            unitPrice: null,
            amount: 500,
          },
        ],
      }),
      "JPY"
    );
    expect(draft.warnings).toContain("품목 합계와 총액이 달라요");
  });

  it("fills total from subtotal tax tip when total missing", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({ total: null, subtotal: 900, tax: 100, tip: null }),
      "JPY"
    );
    expect(draft.amount).toBe(1000);
    expect(draft.warnings.some((w) => w.includes("소계"))).toBe(true);
  });

  it("suggests trip currency when extract currency is null", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({ currency: null }),
      "JPY"
    );
    expect(draft.currency).toBe("JPY");
    expect(draft.warnings.some((w) => w.includes("통화"))).toBe(true);
  });
});
