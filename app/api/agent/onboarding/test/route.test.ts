import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const runIngest = vi.fn();
const touchServerTestAt = vi.fn(async (_userId: string) => undefined);
const updateEq2 = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: () => ({ ok: true }),
}));
vi.mock("@/lib/agent/ingest-pipeline", () => ({
  runIngest: (...args: unknown[]) => runIngest(...args),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({
    from: () => ({
      update: () => ({ eq: () => ({ eq: updateEq2 }) }),
    }),
  }),
}));
vi.mock("@/lib/onboarding/agent-context", () => ({
  touchServerTestAt: (userId: string) => touchServerTestAt(userId),
}));

describe("POST /api/agent/onboarding/test (서버만 확인)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
    });
    runIngest.mockResolvedValue({
      result: { ok: true, id: "evt-1", duplicate: false },
    });
  });

  it("여행과 무관하게 tripId=null, source=sim 으로만 기록해요", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/onboarding/test", {
        method: "POST",
      })
    );
    expect(res.status).toBe(200);
    expect(runIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        tripId: null,
        source: "sim",
        processIfTrip: false,
      })
    );
    expect(touchServerTestAt).toHaveBeenCalledWith("user-1");
  });

  it("게스트는 401", async () => {
    guardApi.mockResolvedValue({ identity: { kind: "guest" } });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/onboarding/test", {
        method: "POST",
      })
    );
    expect(res.status).toBe(401);
    expect(runIngest).not.toHaveBeenCalled();
  });
});
