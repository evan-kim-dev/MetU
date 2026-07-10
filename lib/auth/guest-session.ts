import { STORAGE_KEYS } from "@/lib/constants";

export const GUEST_COOKIE = "budgettrip-guest";

interface GuestSession {
  loggedIn: boolean;
  provider: "guest";
  loggedInAt: string;
}

export function isGuestCookie(value: string | undefined): boolean {
  return value === "1";
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

export function saveGuestSession() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    STORAGE_KEYS.auth,
    JSON.stringify({
      loggedIn: true,
      provider: "guest",
      loggedInAt: new Date().toISOString(),
    } satisfies GuestSession)
  );
  document.cookie = `${GUEST_COOKIE}=1; path=/; SameSite=Lax`;
}

export function clearGuestSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEYS.auth);
  localStorage.removeItem(STORAGE_KEYS.auth);
  document.cookie = `${GUEST_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/** 예전 localStorage 게스트 세션 제거 */
export function clearLegacyGuestSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.auth);
}

function readGuestCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((part) => part === `${GUEST_COOKIE}=1`);
}

/** sessionStorage ↔ 쿠키 상태를 맞춘다 (탭/브라우저 재진입 시) */
export function syncGuestSession() {
  if (typeof window === "undefined") return false;

  const guest = loadGuestSession();
  const hasCookie = readGuestCookie();

  if (guest && !hasCookie) {
    document.cookie = `${GUEST_COOKIE}=1; path=/; SameSite=Lax`;
    return true;
  }

  if (!guest && hasCookie) {
    document.cookie = `${GUEST_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }

  return guest;
}
