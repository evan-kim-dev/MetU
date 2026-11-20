/**
 * 「로그인 유지」선호.
 * - true(기본): 브라우저를 닫아도 세션 유지
 * - false: 이번 브라우저 세션만. 다시 열면 로그아웃 처리
 */

export const REMEMBER_ME_STORAGE_KEY = "metu.auth.remember";
export const AUTH_ALIVE_STORAGE_KEY = "metu.auth.alive";

export function getRememberMe(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function setRememberMe(remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      REMEMBER_ME_STORAGE_KEY,
      remember ? "1" : "0"
    );
    if (remember) {
      window.sessionStorage.removeItem(AUTH_ALIVE_STORAGE_KEY);
    } else {
      markAuthSessionAlive();
    }
  } catch {
    /* private mode 등 */
  }
}

/** 현재 탭/브라우저 세션이 살아 있음을 표시 (OAuth 왕복 포함). */
export function markAuthSessionAlive(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTH_ALIVE_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * 로그인 유지 OFF 인데 브라우저를 새로 연 경우(세션 플래그 없음)
 * → 남아 있는 영속 쿠키/스토리지를 지워야 함.
 */
export function shouldClearPersistedSession(): boolean {
  if (typeof window === "undefined") return false;
  if (getRememberMe()) return false;
  try {
    return window.sessionStorage.getItem(AUTH_ALIVE_STORAGE_KEY) !== "1";
  } catch {
    return false;
  }
}
