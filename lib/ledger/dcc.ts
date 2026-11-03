import { merchantBigramSimilarity } from "@/lib/ledger/dedupe";

/** VERIFY: 짧은 중복결제 창(분). 확정 수수료가 아님. */
const DUP_CHARGE_WINDOW_MIN = Number(
  process.env.DUP_CHARGE_WINDOW_MIN ?? "10"
);

/**
 * 2020년 기준 금융감독원 통계를 인용한 이데일리(2022-09-20) 보도.
 * 계산에는 쓰지 않고 펼침 안내 문구에만 사용한다.
 */
export const DCC_PUBLIC_STAT_NOTE =
  "2020년 기준 · 금융감독원 통계(이데일리 2022-09-20 보도 인용)에 따르면 해외 가맹점 결제 중 41.8%가 원화결제, 원화결제 수수료는 3~8%로 알려져 있어요.";

export const DCC_PUBLIC_STAT_URL =
  "https://www.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=01177526632462088";

type DccLevel = "none" | "suspected" | "confirmed";

export type DccResult = {
  level: DccLevel;
  markupPct: number | null;
  markupKrw: number | null;
};

export type ReceiptSecondaryAmount = {
  currency: string;
  amount: number;
  label?: string | null;
};

/**
 * DCC(해외 원화결제) 판정. 환율은 인자로만 받고 조회하지 않는다.
 * confirmed: 영수증에 외화·원화 금액이 둘 다 있을 때만 퍼센트·차이 KRW 계산.
 */
export function detectDcc(input: {
  tripLocalCurrency: string | null | undefined;
  draftCurrency: string | null | undefined;
  overseas?: boolean | null;
  merchant?: string | null;
  receiptSecondary?: ReceiptSecondaryAmount[] | null;
  /** 외화 1단위 → KRW (시장/일별). confirmed 계산용 */
  marketRate?: number | null;
  /** 영수증 본통화 금액(외화) */
  foreignAmount?: number | null;
  foreignCurrency?: string | null;
}): DccResult {
  const tripCcy = (input.tripLocalCurrency ?? "").trim().toUpperCase();
  const draftCcy = (input.draftCurrency ?? "").trim().toUpperCase();
  const none: DccResult = { level: "none", markupPct: null, markupKrw: null };

  if (!tripCcy || tripCcy === "KRW") return none;

  const secondaries = input.receiptSecondary ?? [];
  const krwSecondary = secondaries.find(
    (s) => s.currency.trim().toUpperCase() === "KRW" && Number.isFinite(s.amount)
  );
  const foreignCcy = (input.foreignCurrency ?? draftCcy).trim().toUpperCase();
  const foreignAmt =
    typeof input.foreignAmount === "number" && Number.isFinite(input.foreignAmount)
      ? input.foreignAmount
      : null;
  const rate =
    typeof input.marketRate === "number" &&
    Number.isFinite(input.marketRate) &&
    input.marketRate > 0
      ? input.marketRate
      : null;

  if (
    krwSecondary &&
    foreignAmt != null &&
    foreignCcy &&
    foreignCcy !== "KRW" &&
    rate != null
  ) {
    const marketKrw = Math.round(foreignAmt * rate);
    const billed = Math.round(krwSecondary.amount);
    const markupKrw = billed - marketKrw;
    const markupPct = marketKrw > 0 ? markupKrw / marketKrw : null;
    return {
      level: "confirmed",
      markupPct:
        markupPct != null && Number.isFinite(markupPct) ? markupPct : null,
      markupKrw,
    };
  }

  const overseas = input.overseas === true;
  if (overseas && draftCcy === "KRW") {
    return { level: "suspected", markupPct: null, markupKrw: null };
  }

  // 영수증이 현지 통화인데 결제 통화만 KRW
  if (
    foreignCcy &&
    foreignCcy !== "KRW" &&
    foreignCcy === tripCcy &&
    draftCcy === "KRW"
  ) {
    return { level: "suspected", markupPct: null, markupKrw: null };
  }

  return none;
}

export type DupChargeCandidate = {
  merchant: string;
  amount: number;
  currency: string;
  paidAtMs: number;
  exactResend?: boolean;
};

/**
 * 같은 가맹점(유사도≥0.8)·같은 금액·통화가 N분 이내 반복되면 중복결제 가능성.
 * exactResend(동일 문자 재전달)는 제외.
 */
export function detectDupCharge(
  draft: DupChargeCandidate,
  prior: DupChargeCandidate[],
  windowMin: number = DUP_CHARGE_WINDOW_MIN
): boolean {
  if (draft.exactResend) return false;
  if (!Number.isFinite(draft.amount) || !draft.currency || !draft.merchant) {
    return false;
  }
  const windowMs = Math.max(1, windowMin) * 60_000;
  const ccy = draft.currency.trim().toUpperCase();

  for (const p of prior) {
    if (p.exactResend) continue;
    if (p.currency.trim().toUpperCase() !== ccy) continue;
    if (p.amount !== draft.amount) continue;
    const sim = merchantBigramSimilarity(draft.merchant, p.merchant);
    if (sim < 0.8) continue;
    const dt = Math.abs(draft.paidAtMs - p.paidAtMs);
    if (dt <= windowMs) return true;
  }
  return false;
}
