/**
 * 확인함·가계부 상태 언어 (EDR trip-centric IA §6).
 * UI·배지·카피는 이 상수만 쓴다.
 */

/** 사용자에게 보이는 대기열 이름. 경로 `/agent/inbox` 는 유지. */
export const INBOX_NAME = "확인함";

/** 지출·이벤트 카드에 쓰는 통일 상태 (EDR §6). */
export const LEDGER_STATUS = {
  autoSaved: "자동 기록됨",
  needsReview: "확인이 필요해요",
  edited: "수정됨",
  splitPending: "분담 확인",
} as const;

export type LedgerStatusKey = keyof typeof LEDGER_STATUS;

/** 「수신함」 레거시 카피를 확인함으로 바꿀 때 쓰는 치환. */
export function inboxPhrase(legacyWithInboxWord: string): string {
  return legacyWithInboxWord.replaceAll("수신함", INBOX_NAME);
}
