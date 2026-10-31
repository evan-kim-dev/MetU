import { describe, expect, it } from "vitest";
import { isPublicPagePath, isPublicPath } from "@/lib/auth/route-access";

describe("isPublicPath", () => {
  it("allows PWA static assets", () => {
    expect(isPublicPath("/sw.js")).toBe(true);
    expect(isPublicPath("/site.webmanifest")).toBe(true);
    expect(isPublicPath("/offline.html")).toBe(true);
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/robots.txt")).toBe(true);
    expect(isPublicPath("/.well-known/assetlinks.json")).toBe(true);
  });

  it("allows login, legal and auth", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/legal/privacy")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("allows the public about page", () => {
    expect(isPublicPath("/about")).toBe(true);
    expect(isPublicPath("/about/")).toBe(true);
    expect(isPublicPath("/aboutx")).toBe(false);
  });

  it("allows shared settlement links", () => {
    expect(isPublicPath("/s/abc")).toBe(true);
    expect(isPublicPath("/trips/share/abc")).toBe(true);
  });

  it("allows the PWA share target", () => {
    expect(isPublicPath("/share-target")).toBe(true);
  });

  it("does not treat trips, agent or join as public", () => {
    expect(isPublicPath("/trips")).toBe(false);
    expect(isPublicPath("/trips/123")).toBe(false);
    expect(isPublicPath("/agent")).toBe(false);
    expect(isPublicPath("/join/abc")).toBe(false);
    expect(isPublicPath("/sx")).toBe(false);
  });
});

describe("isPublicPagePath (AuthGate)", () => {
  it("opens about, legal, login, auth and share links without login", () => {
    for (const path of [
      "/about",
      "/legal",
      "/login",
      "/auth/callback",
      "/s/abc",
      "/trips/share/abc",
    ]) {
      expect(isPublicPagePath(path), path).toBe(true);
    }
  });

  it("keeps trips and join gated", () => {
    expect(isPublicPagePath("/trips")).toBe(false);
    expect(isPublicPagePath("/trips/123")).toBe(false);
    expect(isPublicPagePath("/join/abc")).toBe(false);
  });

  it("does not open static assets or share-target as pages", () => {
    expect(isPublicPagePath("/sw.js")).toBe(false);
    expect(isPublicPagePath("/share-target")).toBe(false);
  });
});
