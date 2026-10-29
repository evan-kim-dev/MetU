import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import type { ReceiptDraft } from "@/lib/ledger/receipt-postprocess";

type ReceiptApiOk = {
  draft: ReceiptDraft | null;
  rawExtract?: unknown;
  rejected?: { reason?: string };
};

/** `/api/ledger/receipt` JSON → 확인 시트 초안 */
export function receiptResponseToDraft(
  data: ReceiptApiOk
):
  | { ok: true; draft: ExpenseDraftInput }
  | { ok: false; reason: "not-receipt" | "empty" } {
  if (data.rejected?.reason === "not-receipt" || data.draft == null) {
    return { ok: false, reason: "not-receipt" };
  }
  const d = data.draft;
  if (!d.isReceipt) {
    return { ok: false, reason: "not-receipt" };
  }
  return {
    ok: true,
    draft: {
      origin: "receipt",
      source: "receipt",
      merchant: d.merchant,
      merchantKo: d.merchantKo,
      amount: d.amount,
      currency: d.currency,
      spentOn: d.spentOn,
      paidAt: d.paidAt,
      timeIsEstimated: d.timeIsEstimated,
      category: d.category,
      paymentMethod: d.paymentMethod,
      confidence: d.confidence,
      warnings: d.warnings,
      kind: "approval",
      items: d.items,
      rawInput: data.rawExtract ?? null,
    },
  };
}
