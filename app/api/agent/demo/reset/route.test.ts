import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const getAgentAdmin = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  rejectAnonymousWrite: (identity: { kind?: string; isAnonymous?: boolean }) =>
    identity.kind === "user" && identity.isAnonymous === true
      ? Response.json({ error: "guest-readonly" }, { status: 403 })
      : null,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: () => ({ ok: true }),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => getAgentAdmin(),
}));

describe("POST /api/agent/demo/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "host-1", isAnonymous: false },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("데모 모드가 꺼져 있으면 404", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/reset", { method: "POST" })
    );
    expect(res.status).toBe(404);
    expect(guardApi).not.toHaveBeenCalled();
  });

  it("비로그인은 401", async () => {
    guardApi.mockResolvedValue({ identity: { kind: "guest" } });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/reset", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("익명 사용자는 403", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "anon-1", isAnonymous: true },
    });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/reset", { method: "POST" })
    );
    expect(res.status).toBe(403);
  });

  it("태그 없는 내 여행은 안 지우고 삭제 건수만 반환해요", async () => {
    const deleteIn = vi.fn().mockResolvedValue({ error: null, count: 1 });
    const deleteEq = vi.fn(() => ({ in: deleteIn }));
    const del = vi.fn(() => ({ eq: deleteEq }));
    const limit = vi.fn().mockResolvedValue({
      data: [
        { id: "real-1", memo: "실제 여행" },
        { id: "demo-1", memo: "[metu-demo:mingling] 데모" },
        { id: "osaka-1", memo: "[metu-demo:osaka] 데모" },
      ],
      error: null,
    });
    const eqUser = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ eq: eqUser }));
    getAgentAdmin.mockReturnValue({
      from: () => ({ select, delete: del }),
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/reset", { method: "POST" })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { deleted: number };
    expect(json).toEqual({ deleted: 1 });
    expect(Object.keys(json)).toEqual(["deleted"]);
    expect(deleteIn).toHaveBeenCalledWith("id", ["demo-1"]);
  });

  it("본인 소유가 아니면 선택 결과에 없어 0건이에요", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqUser = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ eq: eqUser }));
    getAgentAdmin.mockReturnValue({
      from: () => ({ select }),
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/reset", { method: "POST" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 0 });
  });
});
