import { describe, expect, it } from "vitest";
import {
  identitySubject,
  isAnonymousUserIdentity,
  type RequestIdentity,
} from "./identity";

describe("isAnonymousUserIdentity", () => {
  it("maps isAnonymous true", () => {
    const id: RequestIdentity = {
      kind: "user",
      userId: "u1",
      isAnonymous: true,
    };
    expect(isAnonymousUserIdentity(id)).toBe(true);
  });

  it("defaults missing isAnonymous to false", () => {
    const id: RequestIdentity = { kind: "user", userId: "u1" };
    expect(isAnonymousUserIdentity(id)).toBe(false);
  });

  it("cookie guest is not anonymous user", () => {
    const id: RequestIdentity = { kind: "guest", nonce: "n1" };
    expect(isAnonymousUserIdentity(id)).toBe(false);
  });
});

describe("identitySubject", () => {
  it("uses userId for users", () => {
    expect(
      identitySubject({ kind: "user", userId: "abc", isAnonymous: true })
    ).toBe("abc");
  });
});
