// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isNativeApp, nativePlatform } from "./capacitor";

describe("isNativeApp / nativePlatform", () => {
  afterEach(() => {
    delete (window as Window & { Capacitor?: unknown }).Capacitor;
  });

  it("Capacitor 없으면 web / false", () => {
    expect(isNativeApp()).toBe(false);
    expect(nativePlatform()).toBe("web");
  });

  it("네이티브 플랫폼이면 true / ios", () => {
    (window as Window & { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "ios",
    };
    expect(isNativeApp()).toBe(true);
    expect(nativePlatform()).toBe("ios");
  });

  it("isNativePlatform false 면 web", () => {
    (window as Window & { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => false,
      getPlatform: () => "ios",
    };
    expect(isNativeApp()).toBe(false);
    expect(nativePlatform()).toBe("web");
  });
});
