/** Common Korean card / pay apps for notification automation pickers. */
export const NOTIF_APP_PRESETS = [
  "삼성카드",
  "신한카드",
  "KB국민카드",
  "현대카드",
  "롯데카드",
  "하나카드",
  "우리카드",
  "NH농협카드",
  "BC카드",
  "카카오페이",
  "토스",
  "네이버페이",
  "삼성페이",
  "Apple Pay",
] as const;

export type NotifAppPreset = (typeof NOTIF_APP_PRESETS)[number];
