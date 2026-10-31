import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const from = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: () => ({ ok: true }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ from }),
}));

describe("POST /api/agent/demo/seed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({ identity: { kind: "guest" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("데모 모드가 꺼져 있으면 404 이고 세션 검사도 하지 않아요", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/seed", { method: "POST" })
    );
    expect(res.status).toBe(404);
    expect(guardApi).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("데모 모드가 켜져 있으면 기존 동작(게스트는 401)을 유지해요", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/seed", { method: "POST" })
    );
    expect(res.status).toBe(401);
    expect(guardApi).toHaveBeenCalledTimes(1);
  });
});