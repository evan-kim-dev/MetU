import { safeNextPath } from "@/lib/security/safe-next";

/** After onboarding/gate, return safe `next` or `/`. */
export function resolvePostOnboardingPath(search: string): string {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  return safeNextPath(params.get("next"), "/");
}
