export type DetectedPlatform = "ios" | "android" | "desktop" | "other";

export type OnboardingStatus =
  | "pending"
  | "partial"
  | "done"
  | "skipped";

export type AutomationUiState = "off" | "unverified" | "ok" | "silent";

export function detectPlatform(userAgent: string): DetectedPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/windows|macintosh|linux|cros/.test(ua) && !/mobile/.test(ua)) {
    return "desktop";
  }
  return "other";
}

export function computeAutomationState(args: {
  status: OnboardingStatus | null | undefined;
  lastNotificationAt?: string | null;
  lastDeviceTestAt?: string | null;
  hasActiveToken: boolean;
  activeTrip: boolean;
  now?: number;
  silenceHours?: number;
}): AutomationUiState {
  const now = args.now ?? Date.now();
  const silenceHours = args.silenceHours ?? 24;
  const status = args.status ?? "pending";

  if (
    status === "pending" ||
    status === "skipped" ||
    !args.hasActiveToken
  ) {
    return "off";
  }

  if (status === "partial") {
    return "unverified";
  }

  // status === 'done' — silence follows last notification (trip optional).
  const lastRaw = args.lastNotificationAt ?? args.lastDeviceTestAt ?? null;
  const last = lastRaw ? Date.parse(lastRaw) : NaN;
  if (!Number.isFinite(last)) return "silent";
  const ageH = (now - last) / (1000 * 60 * 60);
  if (ageH >= silenceHours) return "silent";

  return "ok";
}
