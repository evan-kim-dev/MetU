const LEGACY_KEYS = [
  "budgettrip-withact-checklist-session",
  "budgettrip-auth:withact",
] as const;

/** One-shot localStorage cleanup for removed WithAct integration. */
export function clearLegacyWithactKeys(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore quota / private mode */
    }
  }
}
