import { parseCardSms, redactSms, type SmsContext } from "@/lib/ledger/sms/parse";

export type SmsParsePreview = {
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  confidence: number;
  kind: string;
};

/**
 * When the shortcut concatenates "title + body", the same card approval often
 * appears twice. Keep the later (usually fuller) fragment starting at the
 * second card bracket or second "승인" amount.
 */
export function stripDuplicatedSmsTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const approvalRe = /승인\s*[\d,.]+원/g;
  const approvals = [...trimmed.matchAll(approvalRe)];
  if (approvals.length < 2) return trimmed;

  const secondApprovalIdx = approvals[1]!.index ?? -1;
  if (secondApprovalIdx <= 0) return trimmed;

  // Prefer the second "[…카드]" header (title+body concat), not "[가림]" etc.
  const cardHeaders = [...trimmed.matchAll(/\[[^\]]*카드[^\]]*\]/g)];
  if (cardHeaders.length >= 2) {
    const secondCardIdx = cardHeaders[1]!.index ?? -1;
    if (secondCardIdx > 0 && secondCardIdx < secondApprovalIdx) {
      return trimmed.slice(secondCardIdx).trim();
    }
  }

  const before = trimmed.slice(0, secondApprovalIdx);
  const headerIdx = before.lastIndexOf("[");
  if (headerIdx > 0) {
    return trimmed.slice(headerIdx).trim();
  }
  return trimmed.slice(secondApprovalIdx).trim();
}

/** Prefer payload.body; fall back to text. Always strip duplicated title. */
export function preferSmsParseText(payload: Record<string, unknown>): string {
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (body) return stripDuplicatedSmsTitle(body);
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  return stripDuplicatedSmsTitle(text);
}

export function buildSmsParsePreview(
  raw: string,
  ctx: SmsContext
): SmsParsePreview | null {
  try {
    const text = stripDuplicatedSmsTitle(redactSms(raw));
    if (!text) return null;
    const parsed = parseCardSms(text, ctx);
    if (parsed.amount == null && !parsed.merchant) return null;
    return {
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      confidence: parsed.confidence,
      kind: parsed.kind,
    };
  } catch {
    return null;
  }
}

/** User-facing hint when createEvent fails due to missing migrations. */
export function migrationHintFromError(error: string): string | null {
  const msg = error.toLowerCase();
  if (
    msg.includes("agent_events_status_check") ||
    (msg.includes("unassigned") && msg.includes("check"))
  ) {
    return "DB 마이그레이션 20261030160000/170000 적용 필요";
  }
  if (
    (msg.includes("trip_id") && msg.includes("null")) ||
    msg.includes('null value in column "trip_id"')
  ) {
    return "DB 마이그레이션 20261030160000/170000 적용 필요";
  }
  return null;
}

export { formatSmsPreviewLabel } from "@/lib/agent/event-status";
