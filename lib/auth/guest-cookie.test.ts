import { describe, expect, it } from "vitest";

import { signGuestCookie, verifyGuestCookie } from "@/lib/auth/guest-cookie";

describe("guest cookie", () => {
  it("rejects bare legacy value 1", async () => {
    const secret = "test-guest-secret-value";
    expect(await verifyGuestCookie("1", secret)).toEqual({ ok: false });
  });

  it("accepts signed cookie and rejects tampering", async () => {
    const secret = "test-guest-secret-value";
    const token = await signGuestCookie(secret);
    expect((await verifyGuestCookie(token, secret)).ok).toBe(true);

    const broken = `${token.slice(0, -4)}xxxx`;
    expect((await verifyGuestCookie(broken, secret)).ok).toBe(false);
  });
});
