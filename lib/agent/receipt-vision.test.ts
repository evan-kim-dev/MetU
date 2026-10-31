import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setGeminiClientForTests } from "@/lib/ai/gemini";
import type { GeminiInteractionsClient } from "@/lib/ai/gemini";
import {
  __resetMemoryUsageSinkForTests,
  resetUsageSinkForTests,
} from "@/lib/ai/usage";
import {
  extractReceiptFromImage,
  redactSensitiveText,
} from "@/lib/agent/receipt-vision";

// 합성 데이터만 사용한다 (실제 상호·카드번호 아님).
const RECEIPT_JSON = {
  is_receipt: true,
  merchant: "ローソン テスト店",
  merchant_ko: "로손 테스트점",
  paid_at: "2026-10-30T14:05",
  currency: "JPY",
  total: 1200,
  items: [
    { name: "おにぎり", name_ko: "주먹밥", qty: 2, unit_price: 600, amount: 1200 },
  ],
  category: "식비",
  payment_method: null,
  confidence: 0.95,
  warnings: [],
};

function clientReturning(text: string) {
  const create = vi.fn().mockResolvedValue({
    id: "i1",
    output_text: text,
    usage: { total_input_tokens: 10, total_output_tokens: 10 },
  });
  setGeminiClientForTests({
    interactions: { create },
  } as GeminiInteractionsClient);
  return create;
}

const ARGS = {
  base64: "AAAA",
  mime: "image/jpeg",
  userId: "u1",
  tripId: "t1",
  hintCurrency: "JPY",
};

beforeEach(() => {
  __resetMemoryUsageSinkForTests();
  resetUsageSinkForTests();
});

afterEach(() => {
  setGeminiClientForTests(null);
  delete process.env.GEMINI_API_KEY;
  __resetMemoryUsageSinkForTests();
  resetUsageSinkForTests();
});

describe("extractReceiptFromImage", () => {
  it("정상 영수증이면 extract 와 초안을 돌려준다", async () => {
    const create = clientReturning(JSON.stringify(RECEIPT_JSON));
    const res = await extractReceiptFromImage(ARGS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.merchant).toBe("ローソン テスト店");
    expect(res.draft.amount).toBe(1200);
    expect(res.draft.currency).toBe("JPY");
    expect(res.draft.spentOn).toBe("2026-10-30");
    expect(res.draft.timeIsEstimated).toBe(false);
    expect(res.draft.items).toHaveLength(1);
    expect(res.draft.paymentMethod).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("영수증이 아니면 not_receipt", async () => {
    clientReturning(JSON.stringify({ ...RECEIPT_JSON, is_receipt: false }));
    const res = await extractReceiptFromImage(ARGS);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("not_receipt");
  });

  it("JSON 이 깨지면 vision_invalid", async () => {
    clientReturning("이건 JSON 이 아니에요 {{{");
    const res = await extractReceiptFromImage(ARGS);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("vision_invalid");
  });

  it("키가 없으면 no_api_key", async () => {
    const res = await extractReceiptFromImage(ARGS);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("no_api_key");
  });

  it("호출 실패는 vision_failed + 원인 detail", async () => {
    const create = vi.fn().mockRejectedValue(new Error("boom"));
    setGeminiClientForTests({
      interactions: { create },
    } as GeminiInteractionsClient);
    const res = await extractReceiptFromImage(ARGS);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("vision_failed");
      expect(res.detail).toBe("boom");
    }
  });

  it("카드번호·주민번호 형태는 결과 텍스트에서 가린다", async () => {
    clientReturning(
      JSON.stringify({
        ...RECEIPT_JSON,
        merchant: "TEST SHOP 4111 1111 1111 1111",
        items: [{ name: "memo 900101-1234567", amount: 1200 }],
        warnings: ["card 4111-1111-1111-1111 detected"],
      })
    );
    const res = await extractReceiptFromImage(ARGS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const dump = JSON.stringify(res);
    expect(dump).not.toContain("4111");
    expect(dump).not.toContain("1234567");
    expect(res.draft.merchant).toContain("[가림]");
  });
});

describe("redactSensitiveText", () => {
  it("일반 상호·금액은 건드리지 않는다", () => {
    expect(redactSensitiveText("LAWSON 1,200 JPY")).toBe("LAWSON 1,200 JPY");
  });
});
