import { describe, expect, it } from "vitest";

import {
  ANDROID_GUIDE,
  assertIosUserStringsSafe,
  faqForCode,
  IOS_GUIDE,
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

  it("ios has 13 steps", () => {
    expect(IOS_GUIDE.steps).toHaveLength(13);
  });
});
