import {
  convertTransfers,
  formatConvertedAmount,
  formatRateText,
} from "@/lib/ledger/settle-currency";
import { formatKRW } from "@/lib/shared/format";

/**
 * 정산 공유 문구. 순수 함수만 둔다.
 * 금액은 입력으로 받은 정수 KRW 를 formatKRW 로 문자열로만 바꾼다(재계산 없음).
 * 계좌번호/카드번호는 받지도 쓰지도 않는다.
 */

export interface ShareTransfer {
  from: string;
  to: string;
  krw: number;
  status?: string;
}

export type ShareValidationReason =
  | "no-transfers"
  | "non-integer-or-non-positive"
  | "self-transfer"
  | "balances-not-zero"
  | "sum-mismatch";

export type ShareValidation =
  | { ok: true; totalKrw: number }
  | { ok: false; reason: ShareValidationReason };

/**
 * 송금 목록 합 == 받을 돈(양수 잔액) 합 인지 확인한다.
 * 잔액 합이 0 이 아니거나 송금이 정수 KRW 가 아니면 공유 문구를 만들지 않는다.
 */
export function validateTransfersAgainstBalances(
  transfers: readonly ShareTransfer[],
  balances: Readonly<Record<string, number>>
): ShareValidation {
  if (transfers.length === 0) return { ok: false, reason: "no-transfers" };

  let transferSum = 0;
  for (const t of transfers) {
    if (!Number.isInteger(t.krw) || t.krw <= 0) {
      return { ok: false, reason: "non-integer-or-non-positive" };
    }
    if (t.from === t.to) return { ok: false, reason: "self-transfer" };
    transferSum += t.krw;
  }

  let positive = 0;
  let negative = 0;
  for (const v of Object.values(balances)) {
    if (!Number.isInteger(v)) {
      return { ok: false, reason: "non-integer-or-non-positive" };
    }
    if (v > 0) positive += v;
    else if (v < 0) negative += -v;
  }
  if (positive !== negative) return { ok: false, reason: "balances-not-zero" };
  if (transferSum !== positive) return { ok: false, reason: "sum-mismatch" };

  return { ok: true, totalKrw: transferSum };
}

export interface BuildShareTextInput {
  tripTitle?: string | null;
  /** memberId → 표시 이름 */
  names: Readonly<Record<string, string>>;
  transfers: readonly ShareTransfer[];
  balances: Readonly<Record<string, number>>;
  /** 절대 URL (/s/[token]). 없으면 링크 줄을 생략한다. */
  shareUrl?: string | null;
  /** 마지막 확인 환율을 쓴 지출 건수 */
  fxFallbackCount?: number;
  /**
   * 참고용 통화 환산(기본 꺼짐). 주면 송금 줄 뒤에 "(약 556 JPY)" 와 환율 안내를 붙인다.
   * rate 는 외화 1단위당 원화. 송금 기준은 계속 원화이고 환율은 호출부가 넘긴다.
   */
  conversion?: { currency: string; rate: number } | null;
}

export type BuildShareTextResult =
  | { ok: true; text: string; totalKrw: number }
  | { ok: false; reason: ShareValidationReason | "unknown-member" };

export function buildShareText(input: BuildShareTextInput): BuildShareTextResult {
  const check = validateTransfersAgainstBalances(
    input.transfers,
    input.balances
  );
  if (!check.ok) return check;

  for (const t of input.transfers) {
    if (!input.names[t.from] || !input.names[t.to]) {
      return { ok: false, reason: "unknown-member" };
    }
  }

  const title = input.tripTitle?.trim();
  const lines: string[] = [
    title ? `[${title}] 정산 안내` : "정산 안내",
    "원화 기준으로 보낼 금액이에요.",
    "",
  ];

  // 환산이 잘못된 입력이면 조용히 끄고 원화 문구만 만든다(기본 동작과 동일).
  const converted = input.conversion
    ? convertTransfers(input.transfers, input.conversion)
    : null;
  const conv = converted?.ok ? converted : null;

  input.transfers.forEach((t, i) => {
    const paid = t.status === "paid" ? " (송금 완료)" : "";
    const ref = conv
      ? ` (약 ${formatConvertedAmount(conv.items[i]!.amount, conv.currency)})`
      : "";
    lines.push(
      `• ${input.names[t.from]} → ${input.names[t.to]} ${formatKRW(t.krw)}${ref}${paid}`
    );
  });

  lines.push("", `총 ${formatKRW(check.totalKrw)}`);
  if (conv) {
    lines.push(
      `참고: ${formatRateText(conv.currency, conv.rate)} 기준 환산이에요. 송금은 원화 기준이에요.`
    );
  }

  if (input.shareUrl) lines.push(`자세히 보기: ${input.shareUrl}`);

  lines.push("송금은 각자 쓰는 앱에서 직접 해 주세요.");

  if (input.fxFallbackCount && input.fxFallbackCount > 0) {
    lines.push(
      `일부 지출(${input.fxFallbackCount}건)은 마지막으로 확인한 환율로 계산했어요.`
    );
  }

  return { ok: true, text: lines.join("\n"), totalKrw: check.totalKrw };
}

/** 검증 실패 이유를 사용자에게 보여줄 한국어 문구로 바꾼다. */
export function shareReasonMessage(
  reason: ShareValidationReason | "unknown-member"
): string {
  switch (reason) {
    case "no-transfers":
      return "보낼 금액이 없어요.";
    case "unknown-member":
      return "멤버 정보를 찾지 못했어요. 새로고침한 뒤 다시 시도해 주세요.";
    default:
      return "정산표와 지출 합계가 맞지 않아요. 정산을 다시 계산해 주세요.";
  }
}
