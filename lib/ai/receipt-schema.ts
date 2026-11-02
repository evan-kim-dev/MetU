import { z } from "zod";

import type { ReceiptItemOut, ReceiptOut } from "@/lib/ai/contracts";

/**
 * 영수증 vision 모델 응답 스키마 (geminiVision 의 response schema 로 전달).
 * - 안 읽히거나 불확실한 값은 null (추측 금지).
 * - 환율·원화 환산 필드는 스키마에 없다. 금액은 인쇄값만.
 * - 변환(transform)은 스키마 밖: z.toJSONSchema 가 만드는 JSON Schema 와 어귷날 수 있음.
 */

export const RECEIPT_CATEGORIES = [
  "식비",
  "교통",
  "숙소",
  "관광",
  "쇼핑",
  "기타",
] as const;

export const RECEIPT_PAYMENT_METHODS = ["card", "cash", "transfer"] as const;

const nullableText = z.string().nullable();
const nullableAmount = z.number().nonnegative().nullable();

/** ISO 4217 통화 3글자. 소문자는 허용하되 toOut 에서 대문자화. */
const currencyCode = z.string().regex(/^[A-Za-z]{3}$/);

export const receiptItemSchema = z.object({
  name: z.string(),
  name_ko: nullableText,
  qty: z.number().nonnegative().nullable(),
  unit_price: nullableAmount,
  amount: nullableAmount,
});

/** 영수증에 함께 인쇄된 다른 금액 (예: 다른 통화 병기, 세금/팁 인쇄 값만). */
export const receiptSecondaryAmountSchema = z.object({
  label: z.string(),
  amount: z.number().nonnegative(),
  currency: currencyCode.nullable(),
});

/** 면세(택스 리퍼드) 안내가 영수증에 보일 때만 eligible 을 채운다. */
export const receiptTaxFreeSchema = z.object({
  eligible: z.boolean().nullable(),
  evidence: nullableText,
});

export const receiptSchema = z.object({
  is_receipt: z.boolean(),
  merchant: nullableText,
  merchant_ko: nullableText,
  paid_at: nullableText,
  currency: currencyCode.nullable(),
  total: nullableAmount,
  subtotal: nullableAmount,
  tax: nullableAmount,
  tip: nullableAmount,
  items: z.array(receiptItemSchema),
  secondary_amounts: z.array(receiptSecondaryAmountSchema),
  tax_free: receiptTaxFreeSchema,
  payment_method: z.enum(RECEIPT_PAYMENT_METHODS).nullable(),
  category: z.enum(RECEIPT_CATEGORIES).nullable(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});

export type ReceiptSchemaOut = z.infer<typeof receiptSchema>;
export type ReceiptItemSchemaOut = z.infer<typeof receiptItemSchema>;

const MAX_ITEMS = 40;
const MAX_SECONDARY = 10;
const MAX_WARNINGS = 8;

function cleanText(value: string | null): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/**
 * 검증된 스키마 출력을 앱 내부 ReceiptOut (camelCase)로 옮긴다.
 * 값을 만들어내지 않는다. 총액 보쵩·통화제안은 여기서 안 함 (그건 receipt-postprocess).
 */
export function receiptSchemaToOut(parsed: ReceiptSchemaOut): ReceiptOut {
  const items: ReceiptItemOut[] = [];
  for (const it of parsed.items.slice(0, MAX_ITEMS)) {
    const name = it.name.trim();
    if (!name) continue;
    items.push({
      name,
      nameKo: cleanText(it.name_ko),
      qty: it.qty,
      unitPrice: it.unit_price,
      amount: it.amount,
    });
  }

  return {
    isReceipt: parsed.is_receipt,
    merchant: cleanText(parsed.merchant),
    merchantKo: cleanText(parsed.merchant_ko),
    paidAt: cleanText(parsed.paid_at),
    currency: parsed.currency ? parsed.currency.toUpperCase() : null,
    total: parsed.total,
    subtotal: parsed.subtotal,
    tax: parsed.tax,
    tip: parsed.tip,
    items,
    secondaryAmounts: parsed.secondary_amounts
      .slice(0, MAX_SECONDARY)
      .map((s) => ({
        label: s.label.trim(),
        amount: s.amount,
        currency: s.currency ? s.currency.toUpperCase() : null,
      })),
    taxFree: {
      eligible: parsed.tax_free.eligible,
      evidence: cleanText(parsed.tax_free.evidence),
    },
    category: parsed.category ?? "기타",
    paymentMethod: parsed.payment_method,
    language: null,
    confidence: parsed.confidence,
    warnings: parsed.warnings
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
      .slice(0, MAX_WARNINGS),
  };
}
