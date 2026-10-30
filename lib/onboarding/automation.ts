import type { AutomationUiState } from "@/lib/onboarding/automation-ui-state";

export type DetectedPlatform = "ios" | "android" | "desktop" | "other";

export type OnboardingStatus =
  | "pending"
  | "partial"
  | "done"
  | "skipped";

export type { AutomationUiState } from "@/lib/onboarding/automation-ui-state";

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
  /** True when agent_events has any recent row (incl. unassigned). */
  hasRecentEvent?: boolean;
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
    // Real device/server timestamps only — hasRecentEvent alone can be a
    // server sim test and must not look "connected" (F-24/F-25).
    if (args.lastNotificationAt || args.lastDeviceTestAt) return "ok";
    return "unverified";
  }

  // status === 'done' — silence follows last notification (trip optional).
  const lastRaw = args.lastNotificationAt ?? args.lastDeviceTestAt ?? null;
  const last = lastRaw ? Date.parse(lastRaw) : NaN;
  if (!Number.isFinite(last)) {
    if (args.hasRecentEvent) return "ok";
    return "silent";
  }
  const ageH = (now - last) / (1000 * 60 * 60);
  if (ageH >= silenceHours) return "silent";

  return "ok";
}
