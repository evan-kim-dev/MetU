import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const getAgentAdmin = vi.fn();
const assertTripMember = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
}));

vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => getAgentAdmin(),
}));

vi.mock("@/lib/agent/membership", () => ({
  assertTripMember: (...args: unknown[]) => assertTripMember(...args),
}));

vi.mock("@/lib/agent/body-limit", () => ({
  readBodyLimited: async (req: Request) => {
    const text = await req.text();
    return { ok: true as const, text };
  },
}));

import { POST } from "@/app/api/agent/expenses/[id]/unmerge/route";

describe("POST /api/agent/expenses/[id]/unmerge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "u1" },
    });
    assertTripMember.mockResolvedValue(true);
  });

  it("calls agent_unmerge_billed_krw with actor", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, unmerged: true },
      error: null,
    });
    getAgentAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "e1", trip_id: "t1", status: "confirmed" },
              error: null,
            }),
          }),
        }),
      }),
      rpc,
    });

    const res = await POST(
      new Request("http://localhost/api/agent/expenses/e1/unmerge", {
        method: "POST",
        body: JSON.stringify({ reason: "test" }),
      }),
      {
        params: Promise.resolve({
          id: "550e8400-e29b-41d4-a716-446655440000",
        }),
      }
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "agent_unmerge_billed_krw",
      expect.objectContaining({
        p_actor: "u1",
        p_expense_id: "550e8400-e29b-41d4-a716-446655440000",
        p_reason: "test",
      })
    );
  });

  it("rejects bad id", async () => {
    getAgentAdmin.mockReturnValue({});
    const res = await POST(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ id: "not-uuid" }) }
    );
    expect(res.status).toBe(400);
  });
});
