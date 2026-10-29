import "server-only";

import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import {
  parseCardSms,
  splitSmsBatch,
  type SmsContext,
} from "@/lib/ledger/sms/parse";

export function extractTextDrafts(
  text: string,
  ctx: SmsContext
): ExpenseDraftInput[] {
  const chunks = splitSmsBatch(text);
  const drafts: ExpenseDraftInput[] = [];

  for (const chunk of chunks) {
    const parsed = parseCardSms(chunk, ctx);
    if (!parsed.ok && parsed.kind === "unknown" && parsed.confidence < 0.3) {
      drafts.push({
        origin: "rule",
        source: "sms",
        merchant: null,
        amount: null,
        currency: null,
        spentOn: null,
        category: "기타",
        confidence: parsed.confidence,
        kind: "unknown",
        warnings: parsed.warnings,
        rawInput: { text: chunk, parsed },
      });
      continue;
    }

    drafts.push({
      origin: "rule",
      source: "sms",
      merchant: parsed.merchant,
      amount: parsed.amount,
      currency: parsed.currency,
      spentOn: parsed.spentOn,
      paidAt: parsed.paidAt,
      timeIsEstimated: parsed.timeIsEstimated,
      category: "기타",
      paymentMethod: "card",
      confidence: parsed.confidence,
      kind: parsed.kind === "cancel" ? "cancel" : parsed.kind === "approval" ? "approval" : "unknown",
      warnings: parsed.warnings,
      rawInput: { text: chunk, parsed },
    });
  }

  return drafts;
}
