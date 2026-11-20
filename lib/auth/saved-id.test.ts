// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getSavedEmail,
  getSaveIdPref,
  persistSavedEmail,
  SAVE_ID_PREF_KEY,
  SAVED_EMAIL_KEY,
  setSaveIdPref,
} from "@/lib/auth/saved-id";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("saved-id", () => {
  it("기본값은 아이디 저장 ON", () => {
    expect(getSaveIdPref()).toBe(true);
  });

  it("선호를 끄면 저장된 이메일도 지워요", () => {
    window.localStorage.setItem(SAVED_EMAIL_KEY, "a@b.com");
    setSaveIdPref(false);
    expect(getSaveIdPref()).toBe(false);
    expect(window.localStorage.getItem(SAVE_ID_PREF_KEY)).toBe("0");
    expect(window.localStorage.getItem(SAVED_EMAIL_KEY)).toBeNull();
  });

  it("선호 ON 일 때만 이메일을 읽고 저장해요", () => {
    setSaveIdPref(true);
    persistSavedEmail(" user@example.com ");
    expect(getSavedEmail()).toBe("user@example.com");

    setSaveIdPref(false);
    persistSavedEmail("other@example.com");
    expect(getSavedEmail()).toBe("");
  });
});
