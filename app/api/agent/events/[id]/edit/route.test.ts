import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const getAgentEventForUser = vi.fn();
const updateEq = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
  rejectAnonymousWrite: () => null,
}));
vi.mock("@/lib/agent/event-access", () => ({
  getAgentEventForUser: (...a: unknown[]) => getAgentEventForUser(...a),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: () => updateEq(),
        }),
      }),
    }),
  }),
}));

function req(body: unknown) {
  return new Request("http://localhost/api/agent/events/x/edit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/events/[id]/edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "u1", isAnonymous: false },
    });
    getAgentEventForUser.mockResolvedValue({
      ok: true,
      event: {
        id: "11111111-1111-4111-8111-111111111111",
        status: "needs_review",
        payload: { text: "old" },
        result: {
          items: [
            {
              decision: "review",
              draft: { merchant: "A", amount: 1, currency: "KRW" },
            },
          ],
        },
      },
    });
    updateEq.mockResolvedValue({ error: null });
  });

  it("updates text", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ text: "새 알림 내용" }), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects empty body", async () => {
    const { POST } = await import("./route");
    expect(
      (
        await POST(req({}), {
          params: Promise.resolve({
            id: "11111111-1111-4111-8111-111111111111",
          }),
        })
      ).status
    ).toBe(400);
  });
});
