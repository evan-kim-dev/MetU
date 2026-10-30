import { STORAGE_KEYS } from "@/lib/constants";

export { GUEST_COOKIE } from "@/lib/auth/guest-cookie";

interface GuestSession {
  loggedIn: boolean;
  provider: "guest";
  loggedInAt: string;
}

export function loadGuestSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.auth);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<GuestSession>;
    return Boolean(parsed.loggedIn && parsed.provider === "guest");
  } catch {
    return false;
  }
}

/** httpOnly 서명 쿠키 발급 (document.cookie 직접 쓰기 금지) */
export async function saveGuestSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  sessionStorage.setItem(
    STORAGE_KEYS.auth,
    JSON.stringify({
      loggedIn: true,
      provider: "guest",
      loggedInAt: new Date().toISOString(),
    } satisfies GuestSession)
  );
  try {
    const res = await fetch("/api/auth/guest", {
      method: "POST",
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    sessionStorage.removeItem(STORAGE_KEYS.auth);
    return false;
  }
}

export async function clearGuestSession(): Promise<void> {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEYS.auth);
  localStorage.removeItem(STORAGE_KEYS.auth);
  await fetch("/api/auth/guest", {
    method: "DELETE",
    credentials: "same-origin",
  });
}

/** 예전 localStorage 게스트 세션 제거 */
export function clearLegacyGuestSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.auth);
}

/** sessionStorage 게스트면 httpOnly 쿠키 재발급 */
export async function syncGuestSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const guest = loadGuestSession();
  if (guest) {
    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        credentials: "same-origin",
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  return false;
}
