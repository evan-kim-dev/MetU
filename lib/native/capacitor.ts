/**
 * Capacitor 네이티브 셸 감지 (클라이언트 전용).
 * SSR / 서버에서는 항상 false.
 */

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function getCapacitor(): CapacitorBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
}

/** WKWebView 등 Capacitor 네이티브 앱에서 실행 중인지 */
export function isNativeApp(): boolean {
  const cap = getCapacitor();
  if (!cap) return false;
  try {
    return Boolean(cap.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** ios | android | web */
export function nativePlatform(): "ios" | "android" | "web" {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return "web";
  try {
    const p = cap.getPlatform?.();
    if (p === "ios" || p === "android") return p;
  } catch {
    /* ignore */
  }
  return "web";
}
