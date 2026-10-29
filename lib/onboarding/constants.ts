export const MTU_ONB_COOKIE = "mtu_onb";

export const MTU_ONB_SKIP_STATUSES = new Set([
  "done",
  "skipped",
  "partial",
] as const);

export const ONB_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;
