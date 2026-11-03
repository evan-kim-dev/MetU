import { describe, expect, it } from "vitest";
import { rejectAnonymousWrite } from "./guard";
import type { RequestIdentity } from "./identity";

describe("rejectAnonymousWrite", () => {
  it("익명 사용자는 403 guest-readonly", async () => {
    const id: RequestIdentity = {
      kind: "user",
      userId: "u1",
      isAnonymous: true,
    };
    const res = rejectAnonymousWrite(id);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    await expect(res!.json()).resolves.toEqual({ error: "guest-readonly" });
  });

  it("일반 사용자는 통과(null)", () => {
    const id: RequestIdentity = { kind: "user", userId: "u1" };
    expect(rejectAnonymousWrite(id)).toBeNull();
  });

  it("쿠키 guest 는 이 헬퍼 대상이 아님(null)", () => {
    const id: RequestIdentity = { kind: "guest", nonce: "n" };
    expect(rejectAnonymousWrite(id)).toBeNull();
  });
});
