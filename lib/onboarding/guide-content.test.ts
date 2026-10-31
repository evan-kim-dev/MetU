import { describe, expect, it } from "vitest";

import { IOS_SHORTCUT_NAME } from "@/lib/onboarding/constants";
import {
  ANDROID_GUIDE,
  ANDROID_PWA_FLOW_SECTION,
  assertIosUserStringsSafe,
  collectIosUserVisibleStrings,
  faqForCode,
  IOS_GUIDE,
  IOS_SMS_AUTOMATION_SECTION,
} from "@/lib/onboarding/guide-content";

describe("guide-content", () => {
  it("has unique step and faq ids", () => {
    const ids = [
      ...IOS_GUIDE.steps.map((s) => s.id),
      ...ANDROID_GUIDE.steps.map((s) => s.id),
      ...IOS_GUIDE.faq.map((f) => f.id),
      ...ANDROID_GUIDE.faq.map((f) => f.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ios steps have doItems, expect, mistakes", () => {
    for (const step of IOS_GUIDE.steps) {
      expect(step.doItems.length).toBeGreaterThan(0);
      expect(step.expect?.length).toBeGreaterThan(0);
      expect(step.mistakes?.length).toBeGreaterThan(0);
    }
  });

  it("android steps have doItems", () => {
    for (const step of ANDROID_GUIDE.steps) {
      expect(step.doItems.length).toBeGreaterThan(0);
    }
  });

  it("faq counts", () => {
    expect(IOS_GUIDE.faq).toHaveLength(13);
    expect(ANDROID_GUIDE.faq).toHaveLength(5);
  });

  it("faqForCode mappings", () => {
    expect(faqForCode("text-or-body-required")?.id).toBe("ios-faq-3");
    expect(faqForCode("unauthorized-code")?.id).toBe("ios-faq-4");
    expect(faqForCode("received-at-format")?.id).toBe("ios-faq-5");
    expect(faqForCode("rate-limited")?.id).toBe("ios-faq-6");
    expect(faqForCode("server-error")?.id).toBe("ios-faq-7");
  });

  it("ios user strings avoid forbidden terms", () => {
    expect(() => assertIosUserStringsSafe(false)).not.toThrow();
    expect(() => assertIosUserStringsSafe(true)).not.toThrow();
  });

  it("ios SMS automation section mentions the 메시지 automation and same shortcut", () => {
    const all = [
      IOS_SMS_AUTOMATION_SECTION.title,
      ...IOS_SMS_AUTOMATION_SECTION.items,
    ].join("\n");
    expect(all).toMatch(/\[메시지\]/);
    expect(all).toMatch(/포함/);
    expect(all).toMatch(/즉시 실행/);
    expect(all).toContain(IOS_SHORTCUT_NAME);
  });

  it("ios guide names the same shortcut as constants", () => {
    const all = IOS_GUIDE.steps.flatMap((s) => s.doItems).join("\n");
    expect(all).toContain(IOS_SHORTCUT_NAME);
  });

  it("no guide copy promises opening the Settings app", () => {
    const all = [
      ...collectIosUserVisibleStrings(true),
      ...ANDROID_GUIDE.steps.flatMap((s) => s.doItems),
      ANDROID_PWA_FLOW_SECTION.title,
      ANDROID_PWA_FLOW_SECTION.note ?? "",
    ].join("\n");
    expect(all).not.toMatch(/설정 앱 열기|설정 앱을 열|설정을 열어/);
  });

  it("ios has 13 steps", () => {
    expect(IOS_GUIDE.steps).toHaveLength(13);
  });
});
