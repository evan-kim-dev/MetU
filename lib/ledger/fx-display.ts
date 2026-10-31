import { minorUnits } from "@/lib/ledger/money";
import type { FxSource, LedgerExpenseRow } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";

/**
 * 지출 행의 환율 표기용 순수 함수. 표시 전용이며 금액/환율을 계산하지 않는다.
 * 저장된 값(amount, fxRateToKrw, krwAmount)을 문자열로만 바꾼다.
 */

export const FX_UNKNOWN_LABEL = "환율 미확인";
export const FX_FALLBACK_LABEL = "마지막 확인 환율";

export interface FxLine {
  /** 외화 결제 여부. KRW 면 false 이고 환율 줄을 보여주지 않는다. */
  isForeign: boolean;
  /** 예: "45,000 JPY" */
  original: string;
  /** 예: "1 JPY = 9.12원". KRW 는 null, 환율이 0/NaN 이면 "환율 미확인" */
  rate: string | null;
  /** 환율이 저장되지 않았거나 유효하지 않음 */
  rateUnknown: boolean;
  /** 예: "11/03 기준". 날짜가 없으면 null */
  rateDate: string | null;
  /** 환율 출처 설명. 예: "일별 환율 자동 조회" */
  sourceLabel: string;
  /** 예: "₩410,400" */
  krw: string;
  /** 마지막으로 확인된 환율(실시간 조회 실패) 여부 */
  isFallback: boolean;
  /** 화면 한 줄 요약. 예: "45,000 JPY · 1 JPY = 9.12원 · 11/03 기준" */
  summary: string;
  /** 스크린리더용 전체 문장 */
  ariaLabel: string;
}

export function formatOriginalAmount(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  const digits = minorUnits(code);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${safe.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${code}`;
}

function formatRateValue(rate: number): string {
  // 1 미만(예: VND)은 유효숫자가 보이도록 소수 자릿수를 늘린다.
  const maxDigits =
    rate >= 1 ? 2 : Math.min(6, Math.max(2, Math.ceil(-Math.log10(rate)) + 2));
  return rate.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });
}

function parseMonthDay(date: string | null | undefined): {
  month: number;
  day: number;
} | null {
  if (!date) return null;
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(date);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;
  return { month, day };
}

export function fxSourceLabel(
  source: FxSource | undefined,
  isFallback: boolean
): string {
  if (isFallback) return FX_FALLBACK_LABEL;
  if (source === "cash_manual") return "직접 입력한 현금 환율";
  return "일별 환율 자동 조회";
}

export function formatFxLine(
  row: Pick<
    LedgerExpenseRow,
    | "amount"
    | "currency"
    | "fxRateToKrw"
    | "fxRateDate"
    | "fxSource"
    | "fxIsFallback"
    | "krwAmount"
  >
): FxLine {
  const code = row.currency.trim().toUpperCase();
  const original = formatOriginalAmount(row.amount, code);
  const krw = formatKRW(row.krwAmount);
  const isFallback = Boolean(row.fxIsFallback);

  if (code === "KRW") {
    return {
      isForeign: false,
      original,
      rate: null,
      rateUnknown: false,
      rateDate: null,
      sourceLabel: "원화 결제",
      krw,
      isFallback: false,
      summary: original,
      ariaLabel: `원화 결제 ${krw}`,
    };
  }

  const rateValid = Number.isFinite(row.fxRateToKrw) && row.fxRateToKrw > 0;
  const md = rateValid ? parseMonthDay(row.fxRateDate) : null;
  const rateDate = md
    ? `${String(md.month).padStart(2, "0")}/${String(md.day).padStart(2, "0")} 기준`
    : null;
  const rate = rateValid
    ? `1 ${code} = ${formatRateValue(row.fxRateToKrw)}원`
    : FX_UNKNOWN_LABEL;
  const sourceLabel = rateValid
    ? fxSourceLabel(row.fxSource, isFallback)
    : FX_UNKNOWN_LABEL;

  const summary = [original, rate, rateDate].filter(Boolean).join(" · ");

  const dateSentence = md ? `${md.month}월 ${md.day}일 기준, ` : "";
  const ariaLabel = rateValid
    ? `외화 ${original}, 환율 ${rate}, ${dateSentence}원화 ${krw}.${
        isFallback
          ? " 마지막으로 확인한 환율이라 정산 전에 확인이 필요해요."
          : ""
      }`
    : `외화 ${original}, 환율을 확인하지 못했어요. 원화 ${krw}.`;

  return {
    isForeign: true,
    original,
    rate,
    rateUnknown: !rateValid,
    rateDate,
    sourceLabel,
    krw,
    isFallback,
    summary,
    ariaLabel,
  };
}
