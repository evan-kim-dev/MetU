/**
 * "내 몫" 카드 표시용 순수 함수. 금액은 서버/정산 결과에서 받은 정수 KRW만 쓴다.
 */

export type MyShareKind = "owe" | "receive" | "zero";

export type MyShareView = {
  /** 표시용 절대값 (정수 KRW) */
  amountKrw: number;
  kind: MyShareKind;
  /** 확정 정산이면 confirmed, 없거나 stale이면 estimate */
  mode: "confirmed" | "estimate";
  label: string;
  hint: string | null;
  /** 확정 + 보낼 돈일 때만 송금 버튼 */
  showPayActions: boolean;
};

export const MY_SHARE_PAY_HINT =
  "토스/카카오 앱이 열리고 금액이 복사돼요. 송금은 직접 확인해 주세요.";

export const MY_SHARE_ESTIMATE_HINT =
  "호스트가 정산을 계산하면 확정돼요";

function kindOf(balance: number): MyShareKind {
  if (balance < 0) return "owe";
  if (balance > 0) return "receive";
  return "zero";
}

function labelOf(kind: MyShareKind, mode: "confirmed" | "estimate"): string {
  if (mode === "estimate") {
    if (kind === "owe") return "예상 · 보낼 돈";
    if (kind === "receive") return "예상 · 받을 돈";
    return "예상 내 몫";
  }
  if (kind === "owe") return "보낼 돈";
  if (kind === "receive") return "받을 돈";
  return "내 몫";
}

/**
 * @param liveBalance 현재 지출 기준 순잔액(+받을 / -보낼)
 * @param hasSettlement 열린(또는 최신) 정산표가 있는지
 * @param stale 정산이 지출과 어긋났는지
 */
export function resolveMyShare(input: {
  liveBalance: number | null;
  hasSettlement: boolean;
  stale: boolean;
}): MyShareView {
  const balance = input.liveBalance ?? 0;
  const kind = kindOf(balance);
  const confirmed = input.hasSettlement && !input.stale;
  const mode: "confirmed" | "estimate" = confirmed ? "confirmed" : "estimate";
  return {
    amountKrw: Math.abs(balance),
    kind,
    mode,
    label: labelOf(kind, mode),
    hint: mode === "estimate" ? MY_SHARE_ESTIMATE_HINT : null,
    showPayActions: mode === "confirmed" && kind === "owe",
  };
}
