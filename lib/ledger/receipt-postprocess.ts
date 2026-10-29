import type { ExpenseCategoryOut, ReceiptOut } from "@/lib/ai/contracts";

export type ReceiptLineItem = {
  name: string;
  nameKo: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
};

export type ReceiptDraft = {
  source: "receipt";
  isReceipt: boolean;
  items: ReceiptLineItem[];
  merchant: string | null;
  merchantKo: string | null;
  amount: number | null;
  currency: string | null;
  paidAt: string | null;
  spentOn: string | null;
  timeIsEstimated: boolean;
  category: ExpenseCategoryOut;
  paymentMethod: "card" | "cash" | "transfer" | null;
  confidence: number;
  warnings: string[];
};

export type PostprocessReceiptInput = ReceiptOut;

export type PostprocessReceiptResult = {
  draft: ReceiptDraft;
  rawExtract: ReceiptOut;
};

function sumItemAmounts(items: ReceiptLineItem[]): number | null {
  let sum = 0;
  let any = false;
  for (const item of items) {
    if (item.amount != null && Number.isFinite(item.amount)) {
      sum += item.amount;
      any = true;
    }
  }
  return any ? sum : null;
}

function parsePaidAt(paidAt: string | null): {
  paidAtIso: string | null;
  spentOn: string | null;
  timeIsEstimated: boolean;
} {
  if (!paidAt?.trim()) {
    return { paidAtIso: null, spentOn: null, timeIsEstimated: true };
  }
  const raw = paidAt.trim();
  const isoMatch = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?)?/.exec(
    raw
  );
  if (isoMatch) {
    const date = isoMatch[1]!;
    const time = isoMatch[2];
    if (time) {
      return {
        paidAtIso: `${date}T${time}:00+09:00`,
        spentOn: date,
        timeIsEstimated: false,
      };
    }
    return {
      paidAtIso: `${date}T12:00:00+09:00`,
      spentOn: date,
      timeIsEstimated: true,
    };
  }
  return { paidAtIso: raw, spentOn: null, timeIsEstimated: true };
}

/** Server-side draft shaping after vision model output. */
export function postprocessReceiptExtract(
  extract: PostprocessReceiptInput,
  tripLocalCurrency: string
): PostprocessReceiptResult {
  const warnings = [...extract.warnings];
  const items: ReceiptLineItem[] = extract.items.map((it) => ({
    name: it.name,
    nameKo: it.nameKo,
    qty: it.qty,
    unitPrice: it.unitPrice,
    amount: it.amount,
  }));

  let total = extract.total;
  const subtotal = extract.subtotal;
  const tax = extract.tax;
  const tip = extract.tip;

  if (total == null) {
    const parts = [subtotal, tax, tip].filter(
      (v): v is number => v != null && Number.isFinite(v)
    );
    if (parts.length >= 2 || (parts.length === 1 && subtotal != null)) {
      const computed =
        (subtotal ?? 0) + (tax ?? 0) + (tip ?? 0);
      if (computed > 0) {
        total = computed;
        warnings.push("총액을 소계·세금·팁 합으로 채웠어요");
      }
    }
  }

  const itemsSum = sumItemAmounts(items);
  if (
    total != null &&
    total > 0 &&
    itemsSum != null &&
    itemsSum > 0
  ) {
    const diffRatio = Math.abs(itemsSum - total) / total;
    if (diffRatio > 0.02) {
      warnings.push("품목 합계와 총액이 달라요");
    }
  }

  let currency = extract.currency;
  const fallbackCurrency = tripLocalCurrency.trim().toUpperCase() || "KRW";
  if (!currency) {
    currency = fallbackCurrency;
    warnings.push(`통화를 확인하지 못해 ${fallbackCurrency} 를 제안해요`);
  }

  const { paidAtIso, spentOn, timeIsEstimated } = parsePaidAt(extract.paidAt);

  const draft: ReceiptDraft = {
    source: "receipt",
    isReceipt: extract.isReceipt,
    items,
    merchant: extract.merchant,
    merchantKo: extract.merchantKo,
    amount: total,
    currency,
    paidAt: paidAtIso,
    spentOn,
    timeIsEstimated,
    category: extract.category,
    paymentMethod: extract.paymentMethod,
    confidence: extract.confidence,
    warnings: [...new Set(warnings)].slice(0, 8),
  };

  const rawExtract: ReceiptOut = {
    ...extract,
    total,
    subtotal,
    tax,
    tip,
    currency: extract.currency,
    warnings: extract.warnings,
  };

  return { draft, rawExtract };
}
