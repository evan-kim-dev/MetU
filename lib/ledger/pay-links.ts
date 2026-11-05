/**
 * 송금 앱 열기(딥링크). 결제 API 연동이 아니다.
 * - 앱을 "열기만" 한다. 금액/수신자를 링크에 싣지 않는다.
 * - 금액은 클립보드로 복사해 사용자가 직접 붙여 넣게 한다.
 * - 앱이 열렸다고 송금이 끝난 것이 아니다. 사용자가 직접 '송금 완료'를 눌러야 한다.
 */

export type PayAppId = "toss" | "kakaopay";

export interface PayApp {
  id: PayAppId;
  label: string;
  /** 앱 실행용 커스텀 스킴(경로 없음) */
  url: string;
}

// VERIFY: 비공식 앱 스킴. 토스 `supertoss://`, 카카오페이는 카카오톡 앱(`kakaotalk://`)으로 연다.
// 결제사 가이드(토스페이먼츠 앱스킴 목록, 2026-11 조사 기준)에서 확인한 값이며
// 송금 화면으로 바로 가는 공식 경로는 확인하지 못했다. 앱/OS 버전에 따라 동작이 다를 수 있다.
export const PAY_APPS: readonly PayApp[] = [
  { id: "toss", label: "토스", url: "supertoss://" },
  { id: "kakaopay", label: "카카오페이", url: "kakaotalk://" },
];

export const PAY_DEEPLINK_NOTICE =
  "앱을 열어도 송금이 끝난 게 아니에요. 직접 송금한 뒤 ‘송금 완료’를 눌러 주세요.";

export function getPayApp(id: PayAppId): PayApp {
  const app = PAY_APPS.find((a) => a.id === id);
  if (!app) throw new Error(`unknown pay app: ${id}`);
  return app;
}

/** 송금 앱 입력칸에 바로 붙여 넣을 수 있는 숫자 문자열. 정수 KRW 만 허용. */
export function payAmountText(krw: number): string | null {
  if (!Number.isInteger(krw) || krw <= 0) return null;
  return String(krw);
}

export type TossSendParams = {
  /** 은행명 (예: 카카오뱅크). 비어 있으면 스킴만. */
  bank?: string | null;
  /** 계좌번호. 하이픈은 제거. */
  accountNo?: string | null;
  /** 정수 KRW */
  amount: number;
};

/**
 * VERIFY: 비공식 `supertoss://send` 스킴. 토스 공식 송금 API 가 아님.
 * 은행·계좌가 없으면 앱 루트(`supertoss://`)만 반환한다.
 */
export function buildTossSendUrl(params: TossSendParams): string | null {
  const amount = payAmountText(params.amount);
  if (!amount) return null;
  const bank = (params.bank ?? "").trim();
  const accountNo = (params.accountNo ?? "").replace(/[-\s]/g, "").trim();
  if (!bank || !accountNo) {
    return getPayApp("toss").url;
  }
  const q = new URLSearchParams({
    bank,
    accountNo,
    amount,
  });
  return `supertoss://send?${q.toString()}`;
}

export type OpenTossPayInput = TossSendParams & {
  /** 계좌번호 클립보드 복사 (데스크톱·딥링크 실패 폴백) */
  copyText: (text: string) => Promise<boolean>;
  /** 기본 window.location.href */
  navigate?: (url: string) => void;
  isMobile?: boolean;
};

/**
 * 모바일: 토스 딥링크 시도 → 실패/데스크톱이면 계좌(있으면) 또는 금액을 클립보드에 복사.
 * 반환: 사용자 안내 문구.
 */
export async function openTossPay(
  input: OpenTossPayInput
): Promise<{ ok: boolean; message: string }> {
  const amount = payAmountText(input.amount);
  if (!amount) {
    return { ok: false, message: "금액을 확인할 수 없어요." };
  }

  const accountNo = (input.accountNo ?? "").replace(/[-\s]/g, "").trim();
  const bank = (input.bank ?? "").trim();
  const clipboardPayload = accountNo || amount;
  const navigate =
    input.navigate ??
    ((url: string) => {
      window.location.href = url;
    });

  const ua =
    typeof navigator !== "undefined" ? navigator.userAgent : "";
  const mobile =
    input.isMobile ??
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  const url = buildTossSendUrl({
    bank,
    accountNo,
    amount: input.amount,
  });
  if (!url) {
    return { ok: false, message: "금액을 확인할 수 없어요." };
  }

  if (mobile) {
    try {
      navigate(url);
    } catch (e) {
      console.error("[openTossPay]", e instanceof Error ? e.message : e);
      const copied = await input.copyText(clipboardPayload);
      return {
        ok: copied,
        message: copied
          ? accountNo
            ? "계좌번호를 복사했어요. 토스 앱에서 붙여 넣어 주세요."
            : payGuidance("토스", formatAmountLabel(input.amount))
          : PAY_OPEN_FAILED_MESSAGE,
      };
    }
    return {
      ok: true,
      message: accountNo
        ? "토스를 열었어요. 송금 후 앱에서 확인해 주세요."
        : payGuidance("토스", formatAmountLabel(input.amount)),
    };
  }

  const copied = await input.copyText(clipboardPayload);
  return {
    ok: copied,
    message: copied
      ? accountNo
        ? "계좌번호를 복사했어요. 모바일에서 토스로 송금해 주세요."
        : payGuidance("토스", formatAmountLabel(input.amount))
      : PAY_OPEN_FAILED_MESSAGE,
  };
}

function formatAmountLabel(krw: number): string {
  return `${krw.toLocaleString("ko-KR")}원`;
}

/** 복사 후 보여 줄 안내 문구(금액은 formatKRW 로 만든 문자열을 받는다). */
export function payGuidance(appLabel: string, amountLabel: string): string {
  return `${amountLabel}을 복사했어요. ${appLabel} 앱에서 받는 분께 직접 송금해 주세요.`;
}

export const PAY_OPEN_FAILED_MESSAGE =
  "앱을 열지 못했어요. 앱이 설치돼 있는지 확인하고 직접 열어 주세요.";

export interface LaunchEnv {
  /** 스킴 이동. 기본은 window.location.assign */
  navigate: (url: string) => void;
  /** document 의 visibilitychange 구독 */
  doc: {
    visibilityState: string;
    addEventListener: (type: string, fn: () => void) => void;
    removeEventListener: (type: string, fn: () => void) => void;
  };
}

export const PAY_LAUNCH_TIMEOUT_MS = 1500;

/**
 * 딥링크를 열고, timeoutMs 안에 페이지가 가려지지 않으면(=앱이 안 열림) onFallback 을 부른다.
 * 정리 함수를 돌려준다(언마운트 시 호출).
 */
export function launchPayApp(
  id: PayAppId,
  opts: {
    onFallback: () => void;
    timeoutMs?: number;
    env?: LaunchEnv;
  }
): () => void {
  const env: LaunchEnv =
    opts.env ?? {
      navigate: (url) => window.location.assign(url),
      doc: document,
    };
  const app = getPayApp(id);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    env.doc.removeEventListener("visibilitychange", onHidden);
  };
  const onHidden = () => {
    if (env.doc.visibilityState === "hidden") finish();
  };
  const timer = setTimeout(() => {
    if (done) return;
    finish();
    opts.onFallback();
  }, opts.timeoutMs ?? PAY_LAUNCH_TIMEOUT_MS);

  env.doc.addEventListener("visibilitychange", onHidden);

  try {
    env.navigate(app.url);
  } catch (e) {
    console.error("[launchPayApp]", e instanceof Error ? e.message : e);
    finish();
    opts.onFallback();
  }

  return finish;
}
