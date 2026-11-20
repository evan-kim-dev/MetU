import { describe, expect, it } from "vitest";
import {
  UPDATE_PASSWORD_PATH,
  buildAuthCallbackUrl,
} from "@/lib/auth/callback-url";

describe("buildAuthCallbackUrl", () => {
  it("next 없으면 /auth/callback 만 반환해요", () => {
    expect(buildAuthCallbackUrl("https://met-u.vercel.app")).toBe(
      "https://met-u.vercel.app/auth/callback"
    );
    expect(buildAuthCallbackUrl("https://met-u.vercel.app", "/")).toBe(
      "https://met-u.vercel.app/auth/callback"
    );
  });

  it("safe next 를 쿼리로 붙여요", () => {
    expect(
      buildAuthCallbackUrl("https://met-u.vercel.app", "/trips/1/ledger")
    ).toBe(
      "https://met-u.vercel.app/auth/callback?next=%2Ftrips%2F1%2Fledger"
    );
    expect(
      buildAuthCallbackUrl("https://met-u.vercel.app", UPDATE_PASSWORD_PATH)
    ).toBe(
      "https://met-u.vercel.app/auth/callback?next=%2Fupdate-password"
    );
  });

  it("외부 URL next 는 / 로 떨어져 쿼리를 붙이지 않아요", () => {
    expect(
      buildAuthCallbackUrl("https://met-u.vercel.app", "https://evil.com")
    ).toBe("https://met-u.vercel.app/auth/callback");
  });
});
