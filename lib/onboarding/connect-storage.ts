import type {
  ConnectSnapshot,
  ConnectPhase,
} from "@/lib/onboarding/connect-machine";
import type { DetectedPlatform } from "@/lib/onboarding/automation";

export const CONNECT_STORAGE_KEY = "metu.connect.v1";

const PHASES = new Set<ConnectPhase>([
  "device",
  "code",
  "shortcut",
  "automation",
  "verify",
  "done",
  "skipped",
  "unsupported",
]);

const PLATFORMS = new Set<DetectedPlatform>([
  "ios",
  "android",
  "desktop",
  "other",
]);

function isSnapshot(value: unknown): value is ConnectSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.phase !== "string" || !PHASES.has(v.phase as ConnectPhase)) {
    return false;
  }
  if (
    typeof v.platform !== "string" ||
    !PLATFORMS.has(v.platform as DetectedPlatform)
  ) {
    return false;
  }
  if (
    !(
      v.ios27 === null ||
      typeof v.ios27 === "boolean" ||
      typeof v.ios27 === "undefined"
    )
  ) {
    return false;
  }
  if (!Array.isArray(v.selectedApps)) return false;
  if (typeof v.serverOk !== "boolean") return false;
  if (typeof v.deviceOk !== "boolean") return false;
  return true;
}

export function loadSnapshot(): ConnectSnapshot | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(CONNECT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSnapshot(parsed)) return null;
    return {
      phase: parsed.phase,
      platform: parsed.platform,
      ios27: parsed.ios27 ?? null,
      selectedApps: parsed.selectedApps.filter(
        (a): a is string => typeof a === "string"
      ),
      serverOk: parsed.serverOk,
      deviceOk: parsed.deviceOk,
    };
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: ConnectSnapshot): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    const safe: ConnectSnapshot = {
      phase: snapshot.phase,
      platform: snapshot.platform,
      ios27: snapshot.ios27,
      selectedApps: snapshot.selectedApps,
      serverOk: snapshot.serverOk,
      deviceOk: snapshot.deviceOk,
    };
    const json = JSON.stringify(safe);
    if (/metu-|mtu_/i.test(json)) {
      return;
    }
    sessionStorage.setItem(CONNECT_STORAGE_KEY, json);
  } catch {
    // Safari private / quota — ignore
  }
}

export function clearSnapshot(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(CONNECT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
