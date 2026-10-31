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

/** MacroDroid Play Store listing. // VERIFY: 패키지 ID com.arlosoft.macrodroid */
export const ANDROID_MACRODROID_URL =
  "https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid";

/** iOS 단축어 앱 URL scheme. 사용자 탭 직후에만 연다(시스템 확인 팝업이 떠요). // VERIFY: iOS 버전별 동작 */
export const IOS_SHORTCUTS_APP_URL = "shortcuts://";

/**
 * 연결 단축어 이름. 사용자가 설치한 이름과 다를 수 있다.
 * // VERIFY: iCloud 공유 단축어의 실제 이름(guide-content 의 "MetU 알림 전송")과 일치하는지 확인
 */
export const IOS_SHORTCUT_NAME = "MetU 알림 전송";

/** shortcuts://run-shortcut?name=… (이름은 URL 인코딩). */
export function buildRunShortcutUrl(name: string = IOS_SHORTCUT_NAME): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}
