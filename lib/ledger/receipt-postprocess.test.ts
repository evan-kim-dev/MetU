import { describe, expect, it } from "vitest";
import { postprocessReceiptExtract } from "@/lib/ledger/receipt-postprocess";
import type { ReceiptOut } from "@/lib/ai/contracts";

const NOW = new Date("2026-03-02T03:00:00.000Z");

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
    secondaryAmounts: [],
    taxFree: { eligible: null, evidence: null },
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

  it("정상 영수증은 경고가 없다", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({
        items: [
          { name: "A", nameKo: null, qty: 2, unitPrice: 455, amount: 910 },
        ],
      }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings).toEqual([]);
  });

  it("품목 합계가 소계와 맞으면 총액과 달라도 경고하지 않는다 (세전 품목가)", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({
        items: [
          { name: "A", nameKo: null, qty: null, unitPrice: null, amount: 909 },
        ],
      }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings).not.toContain("품목 합계와 총액이 달라요");
  });

  it("소계·세금·팁 합이 총액과 다르면 경고한다", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({ total: 1500, subtotal: 909, tax: 91, items: [] }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings).toContain("소계·세금·팁 합과 총액이 달라요");
  });

  it("세금·팁이 총액보다 크면 경고한다", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({ total: 100, subtotal: null, tax: 500, items: [] }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings).toContain("세금이 총액보다 커요");
  });

  it("총액이 0 이하이면 금액을 비우고 경고한다 (지어내지 않음)", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({ total: 0, subtotal: null, tax: null, items: [] }),
      "JPY",
      { now: NOW }
    );
    expect(draft.amount).toBeNull();
    expect(draft.warnings).toContain("총액을 읽지 못했어요");
  });

  it("수량×단가와 금액이 다르면 경고한다", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({
        total: 1000,
        subtotal: null,
        tax: null,
        items: [
          { name: "A", nameKo: null, qty: 2, unitPrice: 300, amount: 1000 },
        ],
      }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings).toContain("품목의 수량×단가와 금액이 달라요");
  });

  it("통화가 없고 다른 통화 금액이 보이면 결제 통화 확인 경고", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({
        currency: null,
        secondaryAmounts: [{ label: "KRW", amount: 9300, currency: "KRW" }],
      }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings).toContain("여러 통화가 보여서 결제 통화를 확인해 주세요");
  });

  it("통화가 있어도 다른 통화 금액이 병기되면 경고한다", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({
        secondaryAmounts: [{ label: "KRW", amount: 9300, currency: "KRW" }],
      }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings.some((w) => w.includes("다른 통화"))).toBe(true);
  });

  it("면세 대상인데 근거가 없으면 경고한다", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({ taxFree: { eligible: true, evidence: null } }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings.some((w) => w.includes("면세"))).toBe(true);
  });

  it("읽을 수 없는 결제 일시·없는 날짜·미래 날짜를 경고한다", () => {
    const bad = postprocessReceiptExtract(
      baseExtract({ paidAt: "어제 저녁" }),
      "JPY",
      { now: NOW }
    );
    expect(bad.draft.warnings).toContain("결제 일시를 읽지 못했어요");
    expect(bad.draft.spentOn).toBeNull();

    const fake = postprocessReceiptExtract(
      baseExtract({ paidAt: "2026-02-31T10:00" }),
      "JPY",
      { now: NOW }
    );
    expect(fake.draft.warnings).toContain("결제 날짜가 올바르지 않아요");

    const future = postprocessReceiptExtract(
      baseExtract({ paidAt: "2026-12-25T10:00" }),
      "JPY",
      { now: NOW }
    );
    expect(future.draft.warnings).toContain("결제 날짜가 미래예요");
  });

  it("결제 일시가 null 이면 날짜 경고는 없다", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({ paidAt: null }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings.some((w) => w.includes("결제"))).toBe(false);
  });

  it("신뢰도가 낮으면 경고한다", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({ confidence: 0.3 }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings).toContain("글자를 확실하게 읽지 못했어요");
  });

  it("서버 검증 경고가 모델 경고보다 앞에 오고 최대 8개다", () => {
    const { draft } = postprocessReceiptExtract(
      baseExtract({
        confidence: 0.3,
        warnings: Array.from({ length: 10 }, (_, i) => `모델 경고 ${i}`),
      }),
      "JPY",
      { now: NOW }
    );
    expect(draft.warnings).toHaveLength(8);
    expect(draft.warnings).toContain("글자를 확실하게 읽지 못했어요");
    expect(draft.warnings.some((w) => w.startsWith("모델 경고"))).toBe(true);
    expect(draft.warnings.indexOf("글자를 확실하게 읽지 못했어요")).toBeLessThan(
      draft.warnings.findIndex((w) => w.startsWith("모델 경고"))
    );
  });
});
