import { describe, expect, it } from "vitest";
import { resolveGuestCookieSecret } from "@/lib/security/guest-secret";

describe("resolveGuestCookieSecret", () => {
  it("prefers env", () => {
    expect(
      resolveGuestCookieSecret({
        GUEST_COOKIE_SECRET: " secret ",
        NODE_ENV: "production",
      })
    ).toBe("secret");
  });

  it("uses dev fallback outside production", () => {
    expect(resolveGuestCookieSecret({ NODE_ENV: "development" })).toBe(
      "dev-guest-cookie-secret"
    );
  });

  it("returns empty in production without env", () => {
    expect(resolveGuestCookieSecret({ NODE_ENV: "production" })).toBe("");
  });
});
