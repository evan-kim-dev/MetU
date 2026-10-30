import { describe, expect, it } from "vitest";
import {
  buildGateRedirect,
  isGateExempt,
  isPublicPath,
} from "@/lib/auth/route-access";

describe("isPublicPath", () => {
  it("allows PWA static assets", () => {
    expect(isPublicPath("/sw.js")).toBe(true);
    expect(isPublicPath("/site.webmanifest")).toBe(true);
    expect(isPublicPath("/offline.html")).toBe(true);
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/robots.txt")).toBe(true);
    expect(isPublicPath("/.well-known/assetlinks.json")).toBe(true);
  });

  it("allows login and auth", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("does not treat trips as public", () => {
    expect(isPublicPath("/trips")).toBe(false);
  });
});

describe("isGateExempt", () => {
  it("exempts onboarding planner and automation", () => {
    expect(isGateExempt("/onboarding")).toBe(true);
    expect(isGateExempt("/onboarding/automation")).toBe(true);
    expect(isGateExempt("/onboarding/shortcut-guide")).toBe(true);
  });

  it("exempts join and inbox", () => {
    expect(isGateExempt("/join/abc")).toBe(true);
    expect(isGateExempt("/agent/inbox")).toBe(true);
  });

  it("gates trip detail", () => {
    expect(isGateExempt("/trips/123")).toBe(false);
  });
});

describe("buildGateRedirect", () => {
  it("adds gate=1 and next for /trips", () => {
    const url = new URL("https://met-u.vercel.app/trips");
    const dest = buildGateRedirect(url, "https://met-u.vercel.app");
    expect(dest.pathname).toBe("/onboarding/automation");
    expect(dest.searchParams.get("gate")).toBe("1");
    expect(dest.searchParams.get("next")).toBe("/trips");
  });

  it("omits next for home", () => {
    const url = new URL("https://met-u.vercel.app/");
    const dest = buildGateRedirect(url, "https://met-u.vercel.app");
    expect(dest.searchParams.get("gate")).toBe("1");
    expect(dest.searchParams.get("next")).toBeNull();
  });

  it("attaches join path as next", () => {
    const join = new URL("https://met-u.vercel.app/join/tok");
    const dest = buildGateRedirect(join, "https://met-u.vercel.app");
    expect(dest.searchParams.get("next")).toBe("/join/tok");
  });

  it("does not attach next for /api paths", () => {
    const url = new URL("https://met-u.vercel.app/api/x");
    const dest = buildGateRedirect(url, "https://met-u.vercel.app");
    expect(dest.searchParams.get("next")).toBeNull();
  });

  it("does not copy unrelated query onto automation", () => {
    const url = new URL("https://met-u.vercel.app/trips?platform=ios&x=1");
    const dest = buildGateRedirect(url, "https://met-u.vercel.app");
    expect(dest.searchParams.get("platform")).toBeNull();
    expect(dest.searchParams.get("next")).toBe("/trips?platform=ios&x=1");
  });
});
