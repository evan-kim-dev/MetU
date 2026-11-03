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
  /** EXIF 촬영시각으로 paidAt/spentOn을 채웠을 때만 'exif' */
  timeSource?: "exif" | "receipt" | null;
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

export type PostprocessReceiptOptions = {
  /** 미래 날짜 검사 기준 시각 (테스트용). 기본은 현재 시각. */
  now?: Date;
};

/** 합계 비교 허용 오차 비율 (반올림·할인 단수 차이 흡수). */
const SUM_TOLERANCE = 0.02;
const LOW_CONFIDENCE = 0.5;
const MAX_WARNINGS = 8;

function isNum(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

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

function differs(a: number, b: number): boolean {
  const base = Math.max(Math.abs(a), Math.abs(b));
  if (base === 0) return false;
  return Math.abs(a - b) / base > SUM_TOLERANCE;
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

/** 실제 달력에 있는 날짜인지 (2026-02-31 같은 값 거르기). */
function isRealDate(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function kstDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + 1));
  return dt.toISOString().slice(0, 10);
}

/**
 * 모델 출력을 검증해 경고로 표시한다. 값을 몰래 고치지 않는다.
 * (총액 보충과 통화 제안만 예외이며 둘 다 경고를 남긴다.)
 */
function collectValidationWarnings(
  extract: ReceiptOut,
  items: ReceiptLineItem[],
  total: number | null,
  currency: string | null,
  spentOn: string | null,
  paidAtRaw: string | null,
  now: Date
): string[] {
  const warnings: string[] = [];

  // 총액 vs 소계·세금·팁
  if (total != null && total > 0) {
    if (isNum(extract.tax) && extract.tax > total) {
      warnings.push("세금이 총액보다 커요");
    }
    if (isNum(extract.tip) && extract.tip > total) {
      warnings.push("팁이 총액보다 커요");
    }
    if (isNum(extract.subtotal) && extract.total != null) {
      const expected =
        extract.subtotal +
        (isNum(extract.tax) ? extract.tax : 0) +
        (isNum(extract.tip) ? extract.tip : 0);
      if (expected > 0 && differs(expected, total)) {
        warnings.push("소계·세금·팁 합과 총액이 달라요");
      }
    }
  }

  // 품목 합계는 총액 또는 (세전) 소계 중 하나와 맞으면 정상으로 본다.
  const itemsSum = sumItemAmounts(items);
  if (total != null && total > 0 && itemsSum != null && itemsSum > 0) {
    const matchesTotal = !differs(itemsSum, total);
    const matchesSubtotal =
      isNum(extract.subtotal) &&
      extract.subtotal > 0 &&
      !differs(itemsSum, extract.subtotal);
    if (!matchesTotal && !matchesSubtotal) {
      warnings.push("품목 합계와 총액이 달라요");
    }
  }

  // 수량 × 단가 vs 금액
  const lineMismatch = items.some(
    (it) =>
      isNum(it.qty) &&
      isNum(it.unitPrice) &&
      isNum(it.amount) &&
      it.qty > 0 &&
      differs(it.qty * it.unitPrice, it.amount)
  );
  if (lineMismatch) {
    warnings.push("품목의 수량×단가와 금액이 달라요");
  }

  // 다른 통화 금액이 함께 인쇄된 경우: 어느 통화가 결제 통화인지 사람이 확인.
  const secondaryCurrencies = new Set(
    extract.secondaryAmounts
      .map((s) => s.currency)
      .filter((c): c is string => c != null)
  );
  if (extract.currency == null && secondaryCurrencies.size > 0) {
    warnings.push("여러 통화가 보여서 결제 통화를 확인해 주세요");
  } else if (
    currency != null &&
    [...secondaryCurrencies].some((c) => c !== currency)
  ) {
    warnings.push("영수증에 다른 통화 금액도 있어요 — 결제 통화를 확인해 주세요");
  }

  // 면세
  if (extract.taxFree.eligible === true && !extract.taxFree.evidence) {
    warnings.push("면세 대상이라고 했지만 근거 문구를 읽지 못했어요");
  }

  // 결제 일시
  if (paidAtRaw?.trim()) {
    if (spentOn == null) {
      warnings.push("결제 일시를 읽지 못했어요");
    } else if (!isRealDate(spentOn)) {
      warnings.push("결제 날짜가 올바르지 않아요");
    } else if (spentOn > nextDay(kstDate(now))) {
      warnings.push("결제 날짜가 미래예요");
    }
  }

  if (extract.confidence < LOW_CONFIDENCE) {
    warnings.push("글자를 확실하게 읽지 못했어요");
  }

  return warnings;
}

/** Server-side draft shaping after vision model output. */
export function postprocessReceiptExtract(
  extract: PostprocessReceiptInput,
  tripLocalCurrency: string,
  options: PostprocessReceiptOptions = {}
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

  if (total != null && !(Number.isFinite(total) && total > 0)) {
    warnings.push("총액을 읽지 못했어요");
    total = null;
  }

  if (total == null) {
    const parts = [subtotal, tax, tip].filter(
      (v): v is number => v != null && Number.isFinite(v)
    );
    if (parts.length >= 2 || (parts.length === 1 && subtotal != null)) {
      const computed = (subtotal ?? 0) + (tax ?? 0) + (tip ?? 0);
      if (computed > 0) {
        total = computed;
        warnings.push("총액을 소계·세금·팁 합으로 채웠어요");
      }
    }
  }

  let currency = extract.currency;
  const fallbackCurrency = tripLocalCurrency.trim().toUpperCase() || "KRW";
  if (!currency) {
    currency = fallbackCurrency;
    warnings.push(`통화를 확인하지 못해 ${fallbackCurrency} 를 제안해요`);
  }

  const { paidAtIso, spentOn, timeIsEstimated } = parsePaidAt(extract.paidAt);

  // 서버 검증 경고를 앞에 둔다 (8개 제한에서 모델 경고에 밀리지 않게).
  const validation = collectValidationWarnings(
    extract,
    items,
    total,
    extract.currency,
    spentOn,
    extract.paidAt,
    options.now ?? new Date()
  );

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
    warnings: [...new Set([...validation, ...warnings])].slice(
      0,
      MAX_WARNINGS
    ),
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
