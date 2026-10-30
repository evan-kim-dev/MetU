export type AutomationUiState = "off" | "unverified" | "ok" | "silent";

/**
 * Home banner mapping (client). Distinct from server `computeAutomationState`.
 * First matching rule wins.
 */
export function toAutomationUiState(s: {
  status: "pending" | "partial" | "done" | "skipped";
  hasActiveToken: boolean;
  hasRecentEvent: boolean;
  lastNotificationAt: string | null;
}): AutomationUiState {
  if (!s.hasActiveToken || s.status === "pending" || s.status === "skipped") {
    return "off";
  }
  if (s.hasRecentEvent) return "ok";
  if (s.lastNotificationAt != null) return "silent";
  return "unverified";
}
