import { describe, expect, it } from "vitest";
import { resolvePostOnboardingPath } from "@/lib/auth/post-login-path";

describe("resolvePostOnboardingPath", () => {
  it("returns safe next", () => {
    expect(resolvePostOnboardingPath("?next=%2Ftrips")).toBe("/trips");
    expect(resolvePostOnboardingPath("next=/join/abc")).toBe("/join/abc");
  });

  it("falls back for missing or evil next", () => {
    expect(resolvePostOnboardingPath("")).toBe("/");
    expect(resolvePostOnboardingPath("?next=https://evil.com")).toBe("/");
    expect(resolvePostOnboardingPath("?next=//evil.com")).toBe("/");
  });
});
