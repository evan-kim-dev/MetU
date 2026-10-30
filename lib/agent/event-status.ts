/** Human-readable agent_events.status labels (Korean). */

export type SmsParsePreviewLabel = {
  amount: number | null;
  currency: string | null;
  merchant: string | null;
};

export function formatSmsPreviewLabel(
  preview: SmsParsePreviewLabel
): string | null {
  const parts: string[] = [];
  if (preview.amount != null) {
    const cur =
      preview.currency === "KRW" || !preview.currency ? "원" : preview.currency;
    parts.push(
      cur === "원"
        ? `${preview.amount.toLocaleString("ko-KR")}원`
        : `${preview.amount} ${cur}`
    );
  }
  if (preview.merchant) parts.push(preview.merchant);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")} (미리보기)`;
}

export const AGENT_EVENT_STATUS_LABELS: Record<string, string> = {
  received: "처리 대기",
  processing: "처리 중",
  done: "가계부 저장됨",
  needs_review: "확인 필요",
  ignored: "무시됨",
  failed: "실패",
  unassigned: "여행 없음·보관됨",
};

export function agentEventStatusLabel(status: string): string {
  return AGENT_EVENT_STATUS_LABELS[status] ?? status;
}

/** UI label; test/sim events show as 연결 테스트 (F-33/F-34). */
export function agentEventStatusLabelForUi(args: {
  status: string;
  isTest?: boolean;
}): string {
  if (args.isTest) return "연결 테스트";
  return agentEventStatusLabel(args.status);
}

/** Relative time in Korean, assuming `iso` is an absolute timestamp. */
export function formatRelativeKo(
  iso: string,
  nowMs: number = Date.now()
): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffSec = Math.round((nowMs - t) / 1000);
  if (diffSec < 45) return "방금";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일 전`;
  return new Date(t).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
