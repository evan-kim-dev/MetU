/**
 * 토스 1초 송금 딥링크 유틸.
 * VERIFY: 비공식 `supertoss://send` 스킴. 토스 공식 송금 API 가 아님.
 */

export type TossSendParams = {
  bank: string;
  accountNo: string;
  amount: number;
};

/**
 * 토스 1초 송금 딥링크 규격 생성기
 * supertoss://send?bank={은행명}&accountNo={계좌번호}&amount={금액}
 */
export function buildTossSendUrl(params: TossSendParams): string {
  const cleanAccount = params.accountNo.replace(/[^0-9]/g, "");
  const cleanAmount = Math.max(0, Math.round(params.amount));
  const encodedBank = encodeURIComponent(params.bank.trim());

  return `supertoss://send?bank=${encodedBank}&accountNo=${cleanAccount}&amount=${cleanAmount}`;
}

export type ExecuteTossTransferParams = TossSendParams & {
  onSuccessCopy?: () => void;
  /** 테스트용 주입 */
  navigate?: (url: string) => void;
  writeText?: (text: string) => Promise<void>;
  isMobile?: boolean;
};

/**
 * 송금 버튼 클릭 핸들러 (모바일은 토스 앱 실행, 실패/PC는 계좌·금액 복사)
 */
export async function executeTossTransfer(
  params: ExecuteTossTransferParams
): Promise<{ mode: "app" | "copy" }> {
  const cleanAccount = params.accountNo.replace(/[^0-9]/g, "");
  const cleanAmount = Math.max(0, Math.round(params.amount));
  const tossUrl = buildTossSendUrl(params);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobile =
    params.isMobile ??
    (typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod/i.test(ua));

  const navigate =
    params.navigate ??
    ((url: string) => {
      window.location.href = url;
    });
  const writeText =
    params.writeText ??
    (async (text: string) => {
      await navigator.clipboard.writeText(text);
    });

  if (isMobile) {
    navigate(tossUrl);
    return { mode: "app" };
  }

  await writeText(
    `${params.bank.trim()} ${cleanAccount} ${cleanAmount}원`
  );
  params.onSuccessCopy?.();
  return { mode: "copy" };
}
