import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ rpc }),
}));
vi.mock("@/lib/agent/body-limit", () => ({
  readJsonLimited: async (req: Request) => {
    const json = await req.json();
    return { ok: true as const, json };
  },
}));

describe("POST /api/agent/onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
    });
    rpc.mockResolvedValue({ error: null });
  });

  it("allows omitted selectedApps", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/onboarding", {
        method: "POST",
        body: JSON.stringify({ status: "partial", platform: "ios" }),
      })
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "agent_set_onboarding",
      expect.objectContaining({
        p_status: "partial",
        p_selected_apps: null,
      })
    );
  });

  it("allows empty selectedApps array", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/onboarding", {
        method: "POST",
        body: JSON.stringify({
          status: "partial",
          platform: "ios",
          selectedApps: [],
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "agent_set_onboarding",
      expect.objectContaining({ p_selected_apps: [] })
    );
  });
});
