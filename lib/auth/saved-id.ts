/**
 * 「아이디 저장」선호.
 * 로그인 폼에 넣을 이메일을 localStorage 에 보관해요.
 */

export const SAVE_ID_PREF_KEY = "metu.auth.saveId";
export const SAVED_EMAIL_KEY = "metu.auth.savedEmail";

export function getSaveIdPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(SAVE_ID_PREF_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function setSaveIdPref(save: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVE_ID_PREF_KEY, save ? "1" : "0");
    if (!save) {
      window.localStorage.removeItem(SAVED_EMAIL_KEY);
    }
  } catch {
    /* private mode 등 */
  }
}

export function getSavedEmail(): string {
  if (typeof window === "undefined") return "";
  if (!getSaveIdPref()) return "";
  try {
    return window.localStorage.getItem(SAVED_EMAIL_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function persistSavedEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!getSaveIdPref()) {
      window.localStorage.removeItem(SAVED_EMAIL_KEY);
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      window.localStorage.removeItem(SAVED_EMAIL_KEY);
      return;
    }
    window.localStorage.setItem(SAVED_EMAIL_KEY, trimmed);
  } catch {
    /* private mode 등 */
  }
}
