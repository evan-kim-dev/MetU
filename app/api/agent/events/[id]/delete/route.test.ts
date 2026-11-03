import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const getAgentEventForUser = vi.fn();
const del = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
  rejectAnonymousWrite: (identity: { kind?: string; isAnonymous?: boolean }) =>
    identity.kind === "user" && identity.isAnonymous === true
      ? Response.json({ error: "guest-readonly" }, { status: 403 })
      : null,
}));
vi.mock("@/lib/agent/event-access", () => ({
  getAgentEventForUser: (...a: unknown[]) => getAgentEventForUser(...a),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({
    from: () => ({
      delete: () => ({
        eq: () => ({
          eq: () => del(),
        }),
      }),
    }),
  }),
}));

function req() {
  return new Request("http://localhost/api/agent/events/x/delete", {
    method: "POST",
  });
}

describe("POST /api/agent/events/[id]/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "u1", isAnonymous: false },
    });
    getAgentEventForUser.mockResolvedValue({
      ok: true,
      event: { id: "11111111-1111-4111-8111-111111111111", status: "needs_review" },
    });
    del.mockResolvedValue({ error: null });
  });

  it("deletes own event", async () => {
    const { POST } = await import("./route");
    const res = await POST(req(), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(res.status).toBe(200);
  });

  it("processing → 409", async () => {
    getAgentEventForUser.mockResolvedValue({
      ok: true,
      event: { id: "11111111-1111-4111-8111-111111111111", status: "processing" },
    });
    const { POST } = await import("./route");
    expect(
      (
        await POST(req(), {
          params: Promise.resolve({
            id: "11111111-1111-4111-8111-111111111111",
          }),
        })
      ).status
    ).toBe(409);
  });
});
