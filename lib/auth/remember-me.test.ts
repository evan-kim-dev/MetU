// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AUTH_ALIVE_STORAGE_KEY,
  REMEMBER_ME_STORAGE_KEY,
  getRememberMe,
  markAuthSessionAlive,
  setRememberMe,
  shouldClearPersistedSession,
} from "@/lib/auth/remember-me";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("remember-me", () => {
  it("기본값은 로그인 유지 ON", () => {
    expect(getRememberMe()).toBe(true);
    expect(shouldClearPersistedSession()).toBe(false);
  });

  it("OFF 로 두면 세션 플래그를 심고, 플래그 없으면 정리 대상", () => {
    setRememberMe(false);
    expect(getRememberMe()).toBe(false);
    expect(window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY)).toBe("0");
    expect(window.sessionStorage.getItem(AUTH_ALIVE_STORAGE_KEY)).toBe("1");
    expect(shouldClearPersistedSession()).toBe(false);

    window.sessionStorage.removeItem(AUTH_ALIVE_STORAGE_KEY);
    expect(shouldClearPersistedSession()).toBe(true);
  });

  it("ON 으로 되돌리면 세션 플래그를 지워요", () => {
    setRememberMe(false);
    setRememberMe(true);
    expect(getRememberMe()).toBe(true);
    expect(window.sessionStorage.getItem(AUTH_ALIVE_STORAGE_KEY)).toBeNull();
  });

  it("markAuthSessionAlive 는 세션 플래그만 심어요", () => {
    markAuthSessionAlive();
    expect(window.sessionStorage.getItem(AUTH_ALIVE_STORAGE_KEY)).toBe("1");
  });
});
