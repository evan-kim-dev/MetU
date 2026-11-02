import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  receiptSchema,
  receiptSchemaToOut,
  type ReceiptSchemaOut,
} from "@/lib/ai/receipt-schema";

// 합성 데이터만 사용한다.
function sample(over: Partial<ReceiptSchemaOut> = {}): ReceiptSchemaOut {
  return {
    is_receipt: true,
    merchant: "ローソン テスト店",
    merchant_ko: "로손 테스트점",
    paid_at: "2026-10-30T14:05",
    currency: "JPY",
    total: 1200,
    subtotal: 1091,
    tax: 109,
    tip: null,
    items: [
      {
        name: "おにぎり",
        name_ko: "주먹밥",
        qty: 2,
        unit_price: 600,
        amount: 1200,
      },
    ],
    secondary_amounts: [],
    tax_free: { eligible: null, evidence: null },
    payment_method: null,
    category: "식비",
    confidence: 0.9,
    warnings: [],
    ...over,
  };
}

const ALL_NULL = {
  is_receipt: false,
  merchant: null,
  merchant_ko: null,
  paid_at: null,
  currency: null,
  total: null,
  subtotal: null,
  tax: null,
  tip: null,
  items: [],
  secondary_amounts: [],
  tax_free: { eligible: null, evidence: null },
  payment_method: null,
  category: null,
  confidence: 0,
  warnings: [],
};

describe("receiptSchema", () => {
  it("정상 출력을 통과시킨다", () => {
    expect(receiptSchema.safeParse(sample()).success).toBe(true);
  });

  it("알 수 없는 값은 모두 null 로 표현할 수 있다", () => {
    expect(receiptSchema.safeParse(ALL_NULL).success).toBe(true);
  });

  it("필수 키가 빠지면 실패한다 (조용한 기본값 없음)", () => {
    const { tax_free: _t, ...rest } = ALL_NULL;
    expect(receiptSchema.safeParse(rest).success).toBe(false);
    const { items: _i, ...rest2 } = ALL_NULL;
    expect(receiptSchema.safeParse(rest2).success).toBe(false);
  });

  it("음수 금액·잘못된 통화·범위 밖 신뢰도는 실패한다", () => {
    expect(receiptSchema.safeParse(sample({ total: -1 })).success).toBe(false);
    expect(receiptSchema.safeParse(sample({ currency: "YEN!" })).success).toBe(
      false
    );
    expect(receiptSchema.safeParse(sample({ confidence: 1.5 })).success).toBe(
      false
    );
  });

  it("카테고리·결제수단은 허용 목록만 통과한다", () => {
    expect(
      receiptSchema.safeParse({ ...sample(), category: "음식" }).success
    ).toBe(false);
    expect(
      receiptSchema.safeParse({ ...sample(), payment_method: "crypto" }).success
    ).toBe(false);
  });

  it("문자열 금액은 받지 않는다", () => {
    expect(
      receiptSchema.safeParse({ ...sample(), total: "1200" }).success
    ).toBe(false);
  });

  it("환율·원화 환산 필드는 스키마에 없다", () => {
    const keys = Object.keys(receiptSchema.shape);
    expect(keys.some((k) => /fx|rate|krw/i.test(k))).toBe(false);
  });

  it("JSON Schema 로 변환할 수 있다 (geminiVision 응답 스키마)", () => {
    const json = z.toJSONSchema(receiptSchema) as {
      properties: Record<string, unknown>;
      required: string[];
    };
    for (const key of [
      "is_receipt",
      "merchant",
      "merchant_ko",
      "paid_at",
      "currency",
      "total",
      "subtotal",
      "tax",
      "tip",
      "items",
      "secondary_amounts",
      "tax_free",
      "payment_method",
      "category",
      "confidence",
      "warnings",
    ]) {
      expect(json.properties).toHaveProperty(key);
      expect(json.required).toContain(key);
    }
  });
});

describe("receiptSchemaToOut", () => {
  it("snake_case → camelCase 로 옮기고 통화는 대문자로 맞춘다", () => {
    const out = receiptSchemaToOut(
      sample({
        currency: "jpy",
        secondary_amounts: [{ label: "KRW 표기", amount: 11000, currency: "krw" }],
        tax_free: { eligible: true, evidence: " TAX FREE " },
      })
    );
    expect(out.currency).toBe("JPY");
    expect(out.merchantKo).toBe("로손 테스트점");
    expect(out.items[0]).toEqual({
      name: "おにぎり",
      nameKo: "주먹밥",
      qty: 2,
      unitPrice: 600,
      amount: 1200,
    });
    expect(out.secondaryAmounts).toEqual([
      { label: "KRW 표기", amount: 11000, currency: "KRW" },
    ]);
    expect(out.taxFree).toEqual({ eligible: true, evidence: "TAX FREE" });
  });

  it("category 가 null 이면 기타, 빈 이름 품목은 버린다", () => {
    const out = receiptSchemaToOut(
      sample({
        category: null,
        items: [
          { name: "  ", name_ko: null, qty: null, unit_price: null, amount: 1 },
          { name: "A", name_ko: "", qty: null, unit_price: null, amount: 5 },
        ],
      })
    );
    expect(out.category).toBe("기타");
    expect(out.items).toHaveLength(1);
    expect(out.items[0]!.nameKo).toBeNull();
  });

  it("값을 만들어내지 않는다 (null 유지)", () => {
    const out = receiptSchemaToOut(ALL_NULL as ReceiptSchemaOut);
    expect(out.isReceipt).toBe(false);
    expect(out.total).toBeNull();
    expect(out.currency).toBeNull();
    expect(out.paidAt).toBeNull();
    expect(out.paymentMethod).toBeNull();
  });
});
