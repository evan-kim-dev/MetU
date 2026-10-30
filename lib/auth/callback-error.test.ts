import { describe, expect, it } from "vitest";
import {
  callbackErrorCode,
  callbackErrorToUserFacing,
} from "@/lib/auth/callback-error";

describe("callbackErrorCode", () => {
  it("maps known oauth codes", () => {
    expect(callbackErrorCode("access_denied")).toBe("access_denied");
    expect(callbackErrorCode("missing_code")).toBe("missing_code");
    expect(callbackErrorCode("exchange_failed")).toBe("exchange_failed");
  });

  it("maps long exchange errors without preserving raw text in code", () => {
    const raw =
      "Unable to exchange external code: 4/0AeanS0qExampleLongOAuthPayload";
    expect(callbackErrorCode(raw)).toBe("exchange_failed");
    const facing = callbackErrorToUserFacing(callbackErrorCode(raw));
    expect(facing.message).not.toContain("Unable");
    expect(facing.message).toBe(
      "로그인을 끝내지 못했어요. 다시 시도해 주세요."
    );
  });

  it("maps unknown short tokens", () => {
    expect(callbackErrorCode("weird")).toBe("unknown");
  });
});

describe("callbackErrorToUserFacing", () => {
  it("shows cancel message for access_denied", () => {
    expect(
      callbackErrorToUserFacing("access_denied").message
    ).toBe("로그인을 취소했어요.");
  });
});
