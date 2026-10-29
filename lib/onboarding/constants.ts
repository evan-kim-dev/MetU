export const MTU_ONB_COOKIE = "mtu_onb";

export const MTU_ONB_SKIP_STATUSES = new Set([
  "done",
  "skipped",
  "partial",
] as const);

export const ONB_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

/** iPhone 단축어 공유 링크 (알림 → /api/ingest/sms { text, receivedAt }). */
export const IOS_SHORTCUT_ICLOUD_URL =
  "https://www.icloud.com/shortcuts/543e569b75d14b96bceb22945734b9ed";
